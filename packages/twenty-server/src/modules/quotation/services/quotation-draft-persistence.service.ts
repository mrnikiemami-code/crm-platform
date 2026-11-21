import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  type QuotationDraftSaveHeader,
  type QuotationDraftSaveLine,
  type QuotationDraftSaveOutcome,
  type QuotationDraftSaveRequest,
} from 'src/modules/quotation/types/quotation-draft-save.type';
import { parseQuotationDraftSaveRequest } from 'src/modules/quotation/utils/parse-quotation-draft-save-request.util';
import { DRAFT_QUOTATION_NUMBER_LABEL } from 'src/modules/quotation/utils/quotation-numbering.util';
import {
  formatExactAmountWithCurrency,
  resolveCurrencyLabel,
} from 'src/modules/quotation/utils/quotation-pdf-display.util';
import { evaluateQuotationDraftTotals } from 'src/modules/quotation/utils/quotation-draft-totals.util';
import {
  QUOTATION_CONTENT_MUTABLE_STATUSES,
  canEditQuotationContent,
  parseQuotationVersion,
} from 'src/modules/quotation/utils/quotation-immutability.util';
import { persianMessageForQuotationCode } from 'src/modules/quotation/utils/quotation-ui-messages.util';

type QuotationHeaderRow = {
  id: string;
  status: string;
  version: number | null;
};

type QuotationLineIdRow = {
  id: string;
};

type PersonNameRow = {
  id: string;
  nameFirstName: string | null;
  nameLastName: string | null;
};

type CompanyNameRow = {
  id: string;
  name: string | null;
};

const rejected = (code: string, detail?: string): QuotationDraftSaveOutcome => ({
  kind: 'REJECTED',
  code,
  message: persianMessageForQuotationCode(code, detail),
});

// The single write path for a quotation draft. Everything a save touches — the
// header, every line, the soft-deleted leftovers and the version claim — runs in
// one PostgreSQL transaction, so a failure anywhere leaves the stored document
// exactly as it was. Money comes from the app's Money Domain; this service only
// verifies that the plan adds up before it stores it.
@Injectable()
export class QuotationDraftPersistenceService {
  private readonly logger = new Logger(QuotationDraftPersistenceService.name);

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async saveDraft({
    authContext,
    body,
  }: {
    authContext: WorkspaceAuthContext;
    body: unknown;
  }): Promise<QuotationDraftSaveOutcome> {
    const parsed = parseQuotationDraftSaveRequest(body);

    if (!parsed.ok) {
      return rejected(parsed.code, parsed.message);
    }

    const request = parsed.value;
    // Authorization is decided once, here, before a connection is taken. The
    // repositories below bypass the per-object check for the same reason every
    // other quotation service does: with the actor's map absent they would deny
    // every write, and the intended authority for this path is this explicit gate.
    const heldPermissions =
      await this.quotationPermissionService.resolveHeldPermissions(authContext);

    if (!heldPermissions.includes('quotation.edit')) {
      return rejected(
        'PERMISSION_MISSING',
        'quotation.edit is required to save a draft',
      );
    }

    try {
      return await this.workspaceOrmManager.executeInWorkspaceContext(
        () =>
          this.workspaceOrmManager.runInWorkspaceTransaction(
            async (transactionScope) => {
              const totals = evaluateQuotationDraftTotals({
                header: request.header,
                lines: request.lines,
              });

              if (!totals.ok) {
                return rejected(totals.code, totals.message);
              }

              return isNonEmptyString(request.quotationId)
                ? this.updateDraft({ transactionScope, request })
                : this.createDraft({ transactionScope, request });
            },
          ),
        authContext,
      );
    } catch (error) {
      this.logger.error(
        `Quotation draft save failed and was rolled back: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  private async createDraft({
    transactionScope,
    request,
  }: {
    transactionScope: WorkspaceTransactionScope;
    request: QuotationDraftSaveRequest;
  }): Promise<QuotationDraftSaveOutcome> {
    const customerName = await this.resolveCustomerName({
      transactionScope,
      header: request.header,
    });

    if (customerName === null) {
      return rejected('CUSTOMER_NOT_FOUND', 'customer record does not exist');
    }

    const quotationRepository = transactionScope.getRepository('quotation', {
      shouldBypassPermissionChecks: true,
    });
    const created = await quotationRepository.insert({
      ...this.buildHeaderColumns(request.header, customerName),
      // A draft is born without a document number: only issuance claims one.
      status: 'DRAFT',
      version: 1,
      quotationNumberLabel: DRAFT_QUOTATION_NUMBER_LABEL,
    });
    const quotationId = created.identifiers[0]?.id;

    if (!isNonEmptyString(quotationId)) {
      return rejected('PERSISTENCE_FAILED', 'quotation was not created');
    }

    if (request.lines.length > 0) {
      const lineRepository = transactionScope.getRepository('quotationLine', {
        shouldBypassPermissionChecks: true,
      });

      await lineRepository.insert(
        request.lines.map((line, index) => ({
          ...this.buildLineColumns(line, index),
          quotationId,
        })),
      );
    }

    return { kind: 'SAVED', quotationId, version: 1, status: 'DRAFT' };
  }

  private async updateDraft({
    transactionScope,
    request,
  }: {
    transactionScope: WorkspaceTransactionScope;
    request: QuotationDraftSaveRequest;
  }): Promise<QuotationDraftSaveOutcome> {
    const quotationId = request.quotationId as string;
    const quotationRepository = transactionScope.getRepository('quotation', {
      shouldBypassPermissionChecks: true,
    });
    const existing = await quotationRepository.findOne({
      where: { id: quotationId },
      select: { id: true, status: true, version: true },
    });

    if (!isDefined(existing) || typeof existing.status !== 'string') {
      return rejected('QUOTATION_NOT_FOUND', 'quotation does not exist');
    }

    const row = existing as unknown as QuotationHeaderRow;

    if (!canEditQuotationContent(row.status)) {
      return rejected(
        'QUOTATION_IMMUTABLE',
        `a quotation in ${row.status} cannot be edited`,
      );
    }

    const currentVersion = parseQuotationVersion(row.version);

    if (currentVersion === null) {
      return rejected(
        'QUOTATION_VERSION_REQUIRED',
        'stored version is unreadable',
      );
    }

    if (
      request.expectedVersion !== null &&
      request.expectedVersion !== currentVersion
    ) {
      return rejected(
        'QUOTATION_VERSION_CONFLICT',
        `expected version ${request.expectedVersion} but stored version is ${currentVersion}`,
      );
    }

    const customerName = await this.resolveCustomerName({
      transactionScope,
      header: request.header,
    });

    if (customerName === null) {
      return rejected('CUSTOMER_NOT_FOUND', 'customer record does not exist');
    }

    // The conditional update is the concurrency gate: a parallel save that bumps
    // the version, or a lifecycle transition that freezes the content, makes this
    // statement match zero rows and the whole transaction is abandoned.
    const updated = await quotationRepository.update(
      {
        id: quotationId,
        version: currentVersion,
        status: In([...QUOTATION_CONTENT_MUTABLE_STATUSES]),
      },
      {
        ...this.buildHeaderColumns(request.header, customerName),
        version: currentVersion + 1,
      },
    );

    if (updated.affected === 0) {
      return this.describeLostClaim({ transactionScope, quotationId, row });
    }

    await this.reconcileLines({
      transactionScope,
      quotationId,
      lines: request.lines,
    });

    return {
      kind: 'SAVED',
      quotationId,
      version: currentVersion + 1,
      status: row.status,
    };
  }

  private async describeLostClaim({
    transactionScope,
    quotationId,
    row,
  }: {
    transactionScope: WorkspaceTransactionScope;
    quotationId: string;
    row: QuotationHeaderRow;
  }): Promise<QuotationDraftSaveOutcome> {
    const quotationRepository = transactionScope.getRepository('quotation', {
      shouldBypassPermissionChecks: true,
    });
    const refreshed = await quotationRepository.findOne({
      where: { id: quotationId },
      select: { id: true, status: true },
    });

    if (!isDefined(refreshed)) {
      return rejected('QUOTATION_NOT_FOUND', 'quotation does not exist');
    }

    const refreshedStatus =
      typeof refreshed.status === 'string' ? refreshed.status : row.status;

    if (!canEditQuotationContent(refreshedStatus)) {
      return rejected(
        'QUOTATION_IMMUTABLE',
        `a quotation in ${refreshedStatus} can no longer be edited`,
      );
    }

    return rejected(
      'QUOTATION_VERSION_CONFLICT',
      'quotation was changed concurrently',
    );
  }

  private async reconcileLines({
    transactionScope,
    quotationId,
    lines,
  }: {
    transactionScope: WorkspaceTransactionScope;
    quotationId: string;
    lines: QuotationDraftSaveLine[];
  }): Promise<void> {
    const lineRepository = transactionScope.getRepository('quotationLine', {
      shouldBypassPermissionChecks: true,
    });
    const existingLines = await lineRepository.find({
      where: { quotationId },
      select: { id: true },
      order: { sortOrder: 'ASC' },
    });
    const existingIds = (existingLines as unknown as QuotationLineIdRow[]).map(
      (line) => line.id,
    );

    const newLineIndexes: number[] = [];

    for (const [index, line] of lines.entries()) {
      const existingLineId = existingIds[index];

      if (isNonEmptyString(existingLineId)) {
        // Editing in place keeps the line id, so history and references survive.
        await lineRepository.update(
          { id: existingLineId },
          this.buildLineColumns(line, index),
        );

        continue;
      }

      newLineIndexes.push(index);
    }

    if (newLineIndexes.length > 0) {
      await lineRepository.insert(
        newLineIndexes.map((index) => ({
          ...this.buildLineColumns(lines[index], index),
          quotationId,
        })),
      );
    }

    const staleLineIds = existingIds.slice(lines.length);

    if (staleLineIds.length > 0) {
      // Soft delete, not destroy: a removed line keeps its row for the audit trail.
      await lineRepository.softDelete(staleLineIds);
    }
  }

  private buildHeaderColumns(
    header: QuotationDraftSaveHeader,
    customerName: string | null,
  ): Record<string, unknown> {
    return {
      name: header.name,
      customerType: header.customerType,
      personId: header.personId,
      companyId: header.companyId,
      currencyCode: header.currencyCode,
      taxPolicy: header.taxPolicy,
      paymentTerms: header.paymentTerms,
      documentDiscountKind: header.documentDiscountKind,
      documentDiscountInputExact: header.documentDiscountInputExact,
      grossExact: header.grossExact,
      lineDiscountExact: header.lineDiscountExact,
      documentDiscountExact: header.documentDiscountExact,
      netExact: header.netExact,
      taxExact: header.taxExact,
      roundingExact: header.roundingExact,
      totalExact: header.totalExact,
      customerName,
      totalDisplay: formatExactAmountWithCurrency(
        header.totalExact,
        resolveCurrencyLabel(header.currencyCode),
      ),
    };
  }

  private buildLineColumns(
    line: QuotationDraftSaveLine,
    sortOrder: number,
  ): Record<string, unknown> {
    return {
      name: line.name,
      kind: line.kind,
      description: line.description,
      unit: line.unit,
      quantityExact: line.quantityExact,
      unitPriceExact: line.unitPriceExact,
      grossExact: line.grossExact,
      discountExact: line.discountExact,
      discountKind: line.discountKind,
      discountInputExact: line.discountInputExact,
      documentDiscountExact: line.documentDiscountExact,
      taxExact: line.taxExact,
      totalExact: line.totalExact,
      sortOrder,
      itemId: line.itemId,
    };
  }

  // Returns null when the referenced customer does not exist in this workspace,
  // which is how a fabricated relation id is refused before the header is written.
  private async resolveCustomerName({
    transactionScope,
    header,
  }: {
    transactionScope: WorkspaceTransactionScope;
    header: QuotationDraftSaveHeader;
  }): Promise<string | null> {
    if (header.customerType === 'PERSON') {
      if (!isNonEmptyString(header.personId)) {
        return null;
      }

      const person = await transactionScope
        .getRepository<PersonNameRow>('person', {
          shouldBypassPermissionChecks: true,
        })
        .findOne({
          where: { id: header.personId },
          select: { id: true, nameFirstName: true, nameLastName: true },
        });

      if (!isDefined(person)) {
        return null;
      }

      const firstName = isNonEmptyString(person.nameFirstName)
        ? person.nameFirstName
        : '';
      const lastName = isNonEmptyString(person.nameLastName)
        ? person.nameLastName
        : '';
      const label = `${firstName} ${lastName}`.trim();

      return label === '' ? null : label;
    }

    if (!isNonEmptyString(header.companyId)) {
      return null;
    }

    const company = await transactionScope
      .getRepository<CompanyNameRow>('company', {
        shouldBypassPermissionChecks: true,
      })
      .findOne({
        where: { id: header.companyId },
        select: { id: true, name: true },
      });

    return isDefined(company) && isNonEmptyString(company.name)
      ? company.name
      : null;
  }
}
