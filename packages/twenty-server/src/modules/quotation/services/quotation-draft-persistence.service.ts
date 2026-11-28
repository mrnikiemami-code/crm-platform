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
import { type WorkspaceQuotationCurrencyRow } from 'src/modules/quotation/types/quotation-currency.type';
import { type WorkspaceTaxPolicyRow } from 'src/modules/quotation/types/tax-policy.type';
import { parseQuotationDraftSaveRequest } from 'src/modules/quotation/utils/parse-quotation-draft-save-request.util';
import { DRAFT_QUOTATION_NUMBER_LABEL } from 'src/modules/quotation/utils/quotation-numbering.util';
import {
  formatExactAmountWithCurrency,
  resolveCurrencyLabel,
} from 'src/modules/quotation/utils/quotation-pdf-display.util';
import { evaluateQuotationDraftTotals } from 'src/modules/quotation/utils/quotation-draft-totals.util';
import {
  type DraftTaxPolicyChoice,
  type DraftTaxPolicyStored,
  evaluateDraftTaxPolicy,
} from 'src/modules/quotation/utils/quotation-draft-tax-policy.util';
import {
  QUOTATION_CONTENT_MUTABLE_STATUSES,
  canEditQuotationContent,
  parseQuotationVersion,
} from 'src/modules/quotation/utils/quotation-immutability.util';
import { persianMessageForQuotationCode } from 'src/modules/quotation/utils/quotation-ui-messages.util';
import { acquireCurrencyCatalogReadLock } from 'src/modules/quotation/utils/quotation-currency-lock.util';
import { acquireQuotationUnitCatalogReadLock } from 'src/modules/quotation/utils/quotation-unit-lock.util';
import { type WorkspaceQuotationUnitRow } from 'src/modules/quotation/types/quotation-unit.type';
import { acquireTaxPolicyReadLock } from 'src/modules/quotation/utils/quotation-tax-policy-lock.util';
import {
  buildQuotationAccountingSnapshot,
  type QuotationAccountingSnapshot,
} from 'src/modules/quotation/utils/quotation-accounting-snapshot.util';
import { evaluateDocumentCurrencyForSave } from 'src/modules/quotation/utils/quotation-document-currency.util';
import { commercialColumnsFromDraftHeader } from 'src/modules/quotation/utils/quotation-commercial-header.util';

type UnitSnapshot = { unitRecordId: string; unitCode: string; unit: string; unitAccountingCode: string };
type LineAccountingSnapshot = UnitSnapshot & { taxPolicyRecordId: string | null; taxAccountingCode: string };

type QuotationHeaderRow = {
  id: string;
  status: string;
  version: number | null;
  taxPolicy?: string | null;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
};

type QuotationLineIdRow = {
  id: string;
};

// The ORM hands back `name` as a composite object even when the select lists the flat
// columns, so reading `nameFirstName` off the row silently yields nothing and every
// person draft would be refused as a missing customer.
type PersonNameRow = {
  id: string;
  name: {
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type CompanyNameRow = {
  id: string;
  name: string | null;
};

const rejected = (
  code: string,
  detail?: string,
): QuotationDraftSaveOutcome => ({
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
              // Fixed order Tax → Currency → Unit (F6 / C8): first statements before
              // any row read so lock order cannot invert with catalog mutations.
              await acquireTaxPolicyReadLock(transactionScope);
              await acquireCurrencyCatalogReadLock(transactionScope);
              await acquireQuotationUnitCatalogReadLock(transactionScope);

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

    // A new document has no stored rate to fall back on: the policy named here must
    // be an active policy of this workspace, at exactly its current rate.
    const taxPolicyRejection = await this.assertTaxPolicyAuthority({
      transactionScope,
      request,
      stored: null,
    });

    if (taxPolicyRejection !== null) {
      return taxPolicyRejection;
    }

    const accountingSnapshot = await this.resolveAccountingSnapshot({
      transactionScope,
      request,
    });

    if (!accountingSnapshot.ok) {
      return accountingSnapshot.rejection;
    }

    const quotationRepository = transactionScope.getRepository('quotation', {
      shouldBypassPermissionChecks: true,
    });
    const created = await quotationRepository.insert({
      ...this.buildHeaderColumns(
        request.header,
        customerName,
        accountingSnapshot.value.header,
      ),
      // A draft is born without a document number: only issuance claims one.
      status: 'DRAFT',
      version: 1,
      quotationNumberLabel: DRAFT_QUOTATION_NUMBER_LABEL,
    });
    const quotationId = created.identifiers[0]?.id;

    if (!isNonEmptyString(quotationId)) {
      throw new Error('PERSISTENCE_FAILED: quotation insert identity missing');
    }

    if (request.lines.length > 0) {
      const lineRepository = transactionScope.getRepository('quotationLine', {
        shouldBypassPermissionChecks: true,
      });

      await lineRepository.insert(
        request.lines.map((line, index) => ({
          ...this.buildLineColumns(
            line,
            index,
            accountingSnapshot.value.lines[index],
            accountingSnapshot.value.documentCurrencyCode,
          ),
          quotationId,
        })),
      );
    }

    await this.lockUsedUnitCodes(transactionScope, accountingSnapshot.value.lines);
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
      select: {
        id: true,
        status: true,
        version: true,
        taxPolicy: true,
        taxRateBasisPoints: true,
        dutyRateBasisPoints: true,
      },
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

    // The conditional update is the concurrency gate: a parallel save that bumps
    // the version, or a lifecycle transition that freezes the content, makes this
    // statement match zero rows and the whole transaction is abandoned. A missing
    // version is refused too, so an update can never skip the claim.
    if (request.expectedVersion === null) {
      return rejected(
        'QUOTATION_VERSION_REQUIRED',
        'editing a quotation requires expectedVersion',
      );
    }

    if (request.expectedVersion !== currentVersion) {
      return rejected(
        'QUOTATION_VERSION_CONFLICT',
        `expected version ${request.expectedVersion} but stored version is ${currentVersion}`,
      );
    }

    // The stored pair is what makes a draft survive a later settings edit: it may
    // keep the rate this server wrote, and nothing else.
    const storedTaxPolicy: DraftTaxPolicyStored = {
      code: row.taxPolicy ?? null,
      rateBasisPoints: row.taxRateBasisPoints ?? null,
      dutyRateBasisPoints: row.dutyRateBasisPoints ?? null,
    };
    const taxPolicyRejection = await this.assertTaxPolicyAuthority({
      transactionScope,
      request,
      stored: storedTaxPolicy,
    });

    if (taxPolicyRejection !== null) {
      return taxPolicyRejection;
    }

    const customerName = await this.resolveCustomerName({
      transactionScope,
      header: request.header,
    });

    if (customerName === null) {
      return rejected('CUSTOMER_NOT_FOUND', 'customer record does not exist');
    }

    const accountingSnapshot = await this.resolveAccountingSnapshot({
      transactionScope,
      request,
    });

    if (!accountingSnapshot.ok) {
      return accountingSnapshot.rejection;
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
        ...this.buildHeaderColumns(
          request.header,
          customerName,
          accountingSnapshot.value.header,
        ),
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
      lineSnapshots: accountingSnapshot.value.lines,
      documentCurrencyCode: accountingSnapshot.value.documentCurrencyCode,
    });

    await this.lockUsedUnitCodes(transactionScope, accountingSnapshot.value.lines);
    return {
      kind: 'SAVED',
      quotationId,
      version: currentVersion + 1,
      status: row.status,
    };
  }

  // The one authority check the direct REST boundary was missing. `evaluateQuotationDraftTotals`
  // proves the amounts match the *declared* rate; this proves the declared
  // `(policy, rate)` pair is one this workspace approved. Runs in the same
  // transaction as the write, so the check cannot go stale before the insert.
  private async assertTaxPolicyAuthority({
    transactionScope,
    request,
    stored,
  }: {
    transactionScope: WorkspaceTransactionScope;
    request: QuotationDraftSaveRequest;
    stored: DraftTaxPolicyStored | null;
  }): Promise<QuotationDraftSaveOutcome | null> {
    const code = (request.header.taxPolicy ?? '').trim();
    let policy: DraftTaxPolicyChoice | null = null;

    if (code !== '') {
      let row: WorkspaceTaxPolicyRow | null;

      try {
        row = await transactionScope
          .getRepository<WorkspaceTaxPolicyRow>('taxPolicy', {
            shouldBypassPermissionChecks: true,
          })
          .findOne({
            where: { code },
            select: {
              id: true,
              code: true,
              rateBasisPoints: true,
              dutyRateBasisPoints: true,
              isActive: true,
              accountingCode: true,
            },
          });
      } catch (error) {
        this.logger.error(
          `Tax policy lookup failed for "${code}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        return rejected(
          'TAX_POLICY_UNAVAILABLE',
          'the workspace has no readable tax policy table',
        );
      }

      policy =
        row === null
          ? null
          : {
              code: (row.code ?? code).trim(),
              rateBasisPoints: (row.rateBasisPoints ?? '').trim(),
              dutyRateBasisPoints: (row.dutyRateBasisPoints ?? '0').trim(),
              isActive: row.isActive !== false,
            };
    }

    const decision = evaluateDraftTaxPolicy({
      header: request.header,
      policy,
      stored,
    });

    if (!decision.ok) {
      return rejected(decision.code, decision.message);
    }

    // WS3: every distinct line policy must also be an approved workspace policy.
    return this.assertLineTaxPolicyAuthority({
      transactionScope,
      request,
    });
  }

  private async assertLineTaxPolicyAuthority({
    transactionScope,
    request,
  }: {
    transactionScope: WorkspaceTransactionScope;
    request: QuotationDraftSaveRequest;
  }): Promise<QuotationDraftSaveOutcome | null> {
    const headerCode = (request.header.taxPolicy ?? '').trim();
    const checkedCodes = new Set<string>();

    for (const [index, line] of request.lines.entries()) {
      const lineCode =
        (line.taxPolicy ?? '').trim() || headerCode;

      if (lineCode === '' || checkedCodes.has(lineCode)) {
        if (lineCode === '') {
          const lineTax = (line.taxExact ?? '').trim();

          if (lineTax !== '' && lineTax !== '0' && lineTax !== '0.000000') {
            return rejected(
              'TAX_POLICY_REQUIRED',
              `lines[${index}] needs a tax policy when it carries tax`,
            );
          }
        }

        continue;
      }

      checkedCodes.add(lineCode);

      let row: WorkspaceTaxPolicyRow | null;

      try {
        row = await transactionScope
          .getRepository<WorkspaceTaxPolicyRow>('taxPolicy', {
            shouldBypassPermissionChecks: true,
          })
          .findOne({
            where: { code: lineCode },
            select: {
              id: true,
              code: true,
              rateBasisPoints: true,
              dutyRateBasisPoints: true,
              isActive: true,
              accountingCode: true,
            },
          });
      } catch (error) {
        this.logger.error(
          `Line tax policy lookup failed for "${lineCode}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        return rejected(
          'TAX_POLICY_UNAVAILABLE',
          'the workspace has no readable tax policy table',
        );
      }

      if (row === null) {
        return rejected(
          'TAX_POLICY_UNKNOWN',
          `سیاست مالیات «${lineCode}» در تنظیمات این فضای کاری تعریف نشده است`,
        );
      }

      const linePolicy: DraftTaxPolicyChoice = {
        code: (row.code ?? lineCode).trim(),
        rateBasisPoints: (row.rateBasisPoints ?? '').trim(),
        dutyRateBasisPoints: (row.dutyRateBasisPoints ?? '0').trim(),
        isActive: row.isActive !== false,
      };

      const reusesHeaderPolicy = lineCode === headerCode;

      if (!linePolicy.isActive && !reusesHeaderPolicy) {
        return rejected(
          'TAX_POLICY_INACTIVE',
          `سیاست مالیات «${lineCode}» غیرفعال است`,
        );
      }

      const declaredRate = (
        line.taxRateBasisPoints ??
        request.header.taxRateBasisPoints ??
        ''
      ).trim();
      const declaredDuty = (
        line.dutyRateBasisPoints ??
        request.header.dutyRateBasisPoints ??
        '0'
      ).trim();
      const policyDuty = (linePolicy.dutyRateBasisPoints ?? '0').trim();
      const matchesCatalog =
        declaredRate === linePolicy.rateBasisPoints &&
        declaredDuty === policyDuty;
      const matchesApprovedHeader =
        reusesHeaderPolicy &&
        declaredRate === (request.header.taxRateBasisPoints ?? '').trim() &&
        declaredDuty ===
          (request.header.dutyRateBasisPoints ?? '0').trim();

      if (!matchesCatalog && !matchesApprovedHeader) {
        return rejected(
          'TAX_POLICY_RATE_MISMATCH',
          `نرخ اعلام‌شده با سیاست «${lineCode}» هم‌خوان نیست`,
        );
      }
    }

    return null;
  }

  // WS2-R1 + WS3: fail-closed resolution under Tax→Currency read locks.
  // Empty accountingCode is allowed only when the reference row exists and has none.
  // Every distinct line policy used on the draft is snapshotted and locked by record id.
  private async resolveAccountingSnapshot({
    transactionScope,
    request,
  }: {
    transactionScope: WorkspaceTransactionScope;
    request: QuotationDraftSaveRequest;
  }): Promise<
    | {
        ok: true;
        value: {
          header: QuotationAccountingSnapshot;
          lines: LineAccountingSnapshot[];
          documentCurrencyCode: string;
        };
      }
    | { ok: false; rejection: QuotationDraftSaveOutcome }
  > {
    const policyCache = new Map<
      string,
      { taxPolicyRecordId: string; taxAccountingCode: string }
    >();

    const resolveTaxPolicyRow = async (
      taxPolicyCode: string,
    ): Promise<
      | { ok: true; value: { taxPolicyRecordId: string; taxAccountingCode: string } }
      | { ok: false; rejection: QuotationDraftSaveOutcome }
    > => {
      const cached = policyCache.get(taxPolicyCode);

      if (cached !== undefined) {
        return { ok: true, value: cached };
      }

      let taxRow: WorkspaceTaxPolicyRow | null;

      try {
        taxRow = await transactionScope
          .getRepository<WorkspaceTaxPolicyRow>('taxPolicy', {
            shouldBypassPermissionChecks: true,
          })
          .findOne({
            where: { code: taxPolicyCode },
            select: { id: true, accountingCode: true },
          });
      } catch (error) {
        this.logger.error(
          `Tax accounting snapshot lookup failed for "${taxPolicyCode}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        return {
          ok: false,
          rejection: rejected(
            'TAX_POLICY_UNAVAILABLE',
            'the workspace has no readable tax policy table',
          ),
        };
      }

      if (taxRow === null) {
        return {
          ok: false,
          rejection: rejected(
            'ACCOUNTING_REFERENCE_NOT_FOUND',
            `tax policy "${taxPolicyCode}" was not found for accounting snapshot`,
          ),
        };
      }

      const resolved = {
        taxPolicyRecordId: taxRow.id,
        taxAccountingCode: (taxRow.accountingCode ?? '').trim(),
      };

      policyCache.set(taxPolicyCode, resolved);

      return { ok: true, value: resolved };
    };

    const taxPolicyCode = (request.header.taxPolicy ?? '').trim();
    let headerTax: {
      taxPolicyRecordId: string | null;
      taxAccountingCode: string;
    } = { taxPolicyRecordId: null, taxAccountingCode: '' };

    if (taxPolicyCode !== '') {
      const resolved = await resolveTaxPolicyRow(taxPolicyCode);

      if (!resolved.ok) {
        return resolved;
      }

      headerTax = resolved.value;
    }

    const lineSnapshots: Array<{
      taxPolicyRecordId: string | null;
      taxAccountingCode: string;
    }> = [];

    for (const line of request.lines) {
      const lineCode =
        (line.taxPolicy ?? '').trim() || taxPolicyCode;

      if (lineCode === '') {
        lineSnapshots.push({
          taxPolicyRecordId: null,
          taxAccountingCode: '',
        });
        continue;
      }

      const resolved = await resolveTaxPolicyRow(lineCode);

      if (!resolved.ok) {
        return resolved;
      }

      lineSnapshots.push(resolved.value);
    }

    const currencyCode = (request.header.currencyCode ?? '').trim().toUpperCase();

    if (currencyCode === '') {
      return {
        ok: false,
        rejection: rejected(
          'CURRENCY_CODE_REQUIRED',
          'document currencyCode is required for accounting snapshot',
        ),
      };
    }

    let currencyRow: WorkspaceQuotationCurrencyRow | null;

    try {
      currencyRow = await transactionScope
        .getRepository<WorkspaceQuotationCurrencyRow>('quotationCurrency', {
          shouldBypassPermissionChecks: true,
        })
        .findOne({
          where: { code: currencyCode },
          select: { id: true, accountingCode: true, isActive: true },
        });
    } catch (error) {
      this.logger.error(
        `Currency accounting snapshot lookup failed for "${currencyCode}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        ok: false,
        rejection: rejected(
          'CURRENCY_CATALOG_UNAVAILABLE',
          'the workspace has no readable quotation currency catalog',
        ),
      };
    }

    if (currencyRow === null) {
      return {
        ok: false,
        rejection: rejected(
          'CURRENCY_REFERENCE_NOT_FOUND',
          `currency "${currencyCode}" was not found in the workspace catalog`,
        ),
      };
    }

    // WS4 phase-1: refuse non-IRR and inactive catalog rows before snapshot write.
    const currencyDecision = evaluateDocumentCurrencyForSave({
      currencyCode,
      catalogIsActive: currencyRow.isActive,
    });

    if (!currencyDecision.ok) {
      return {
        ok: false,
        rejection: rejected(currencyDecision.code, currencyDecision.message),
      };
    }

    // Lines must inherit the document currency (no mixed-currency drafts while flag off).
    for (const [index, line] of request.lines.entries()) {
      const lineCurrency = (line.currencyCode ?? '').trim().toUpperCase();

      if (lineCurrency !== '' && lineCurrency !== currencyDecision.currencyCode) {
        return {
          ok: false,
          rejection: rejected(
            'LINE_CURRENCY_MISMATCH',
            `lines[${index}] currency must match the document currency`,
          ),
        };
      }
    }

    const unitSnapshots = await this.resolveUnitSnapshots(transactionScope, request.lines);
    if (!unitSnapshots.ok) return unitSnapshots;

    return {
      ok: true,
      value: {
        header: buildQuotationAccountingSnapshot({
          taxPolicyRecordId: headerTax.taxPolicyRecordId,
          taxAccountingCode: headerTax.taxAccountingCode,
          quotationCurrencyRecordId: currencyRow.id,
          currencyAccountingCode: (currencyRow.accountingCode ?? '').trim(),
        }),
        lines: lineSnapshots.map((snapshot, index) => ({ ...snapshot, ...unitSnapshots.value[index] })),
        documentCurrencyCode: currencyDecision.currencyCode,
      },
    };
  }

  // Resolve the selected unit from the workspace, not from the client's label.
  // Catalog items must use their configured primary unit; no guessed legacy mapping.
  private async resolveUnitSnapshots(scope: WorkspaceTransactionScope, lines: QuotationDraftSaveLine[]): Promise<
    { ok: true; value: UnitSnapshot[] } | { ok: false; rejection: QuotationDraftSaveOutcome }
  > {
    const fail = (code: string, message: string) => ({ ok: false as const, rejection: rejected(code, message) });
    const unitIds = [...new Set(lines.flatMap(line => line.unitRecordId ? [line.unitRecordId] : []))];
    if (lines.some(line => !line.unitRecordId)) return fail('UNIT_MAPPING_REQUIRED', 'واحد اندازه‌گیری هر ردیف را تعیین کنید.');
    const itemIds = [...new Set(lines.flatMap(line => line.itemId ? [line.itemId] : []))];
    const units = await scope.getRepository<WorkspaceQuotationUnitRow>('quotationUnit', { shouldBypassPermissionChecks: true })
      .find({ where: { id: In(unitIds) }, select: { id: true, code: true, name: true, accountingCode: true, isActive: true } });
    const items = itemIds.length ? await scope.getRepository<{ id: string; unitRecordId: string | null; isActive: boolean }>('catalogItem', { shouldBypassPermissionChecks: true })
      .find({ where: { id: In(itemIds) }, select: { id: true, unitRecordId: true, isActive: true } }) : [];
    const unitById = new Map(units.map(unit => [unit.id, unit]));
    const itemById = new Map(items.map(item => [item.id, item]));
    const result: UnitSnapshot[] = [];
    for (const line of lines) {
      const unit = unitById.get(line.unitRecordId ?? '');
      if (!unit || unit.isActive !== true || !unit.code?.trim() || !unit.name?.trim()) {
        return fail('UNIT_MAPPING_REQUIRED', 'واحد اندازه‌گیری معتبر و فعال انتخاب کنید.');
      }
      if (line.itemId) {
        const item = itemById.get(line.itemId);
        if (!item || item.isActive !== true || item.unitRecordId !== unit.id) {
          return fail('UNIT_MAPPING_REQUIRED', 'واحد ردیف با واحد اصلی کالای فعال کاتالوگ یکسان نیست.');
        }
      }
      result.push({ unitRecordId: unit.id, unitCode: unit.code.trim(), unit: unit.name.trim(), unitAccountingCode: (unit.accountingCode ?? '').trim() });
    }
    return { ok: true, value: result };
  }

  private async lockUsedUnitCodes(scope: WorkspaceTransactionScope, snapshots: UnitSnapshot[]): Promise<void> {
    const ids = [...new Set(snapshots.filter(unit => unit.unitAccountingCode !== '').map(unit => unit.unitRecordId))].sort();
    if (ids.length === 0) return;
    const repository = scope.getRepository<WorkspaceQuotationUnitRow>('quotationUnit', { shouldBypassPermissionChecks: true });
    // Monotonic durable flag; the entire save rolls back if this write fails.
    for (const id of ids) {
      const updated = await repository.update({ id }, { accountingCodeLocked: true });
      if (updated.affected !== 1) throw new Error('UNIT_MAPPING_REQUIRED: unit first-use lock not persisted');
    }
  }

  private async describeLostClaim({    transactionScope,
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
    lineSnapshots,
    documentCurrencyCode,
  }: {
    transactionScope: WorkspaceTransactionScope;
    quotationId: string;
    lines: QuotationDraftSaveLine[];
    lineSnapshots: LineAccountingSnapshot[];
    documentCurrencyCode: string;
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
          this.buildLineColumns(
            line,
            index,
            lineSnapshots[index],
            documentCurrencyCode,
          ),
        );

        continue;
      }

      newLineIndexes.push(index);
    }

    if (newLineIndexes.length > 0) {
      await lineRepository.insert(
        newLineIndexes.map((index) => ({
          ...this.buildLineColumns(
            lines[index],
            index,
            lineSnapshots[index],
            documentCurrencyCode,
          ),
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
    accountingSnapshot: QuotationAccountingSnapshot,
  ): Record<string, unknown> {
    return {
      name: header.name,
      customerType: header.customerType,
      personId: header.personId,
      companyId: header.companyId,
      currencyCode: header.currencyCode,
      taxPolicy: header.taxPolicy,
      taxRateBasisPoints: header.taxRateBasisPoints,
      dutyRateBasisPoints: header.dutyRateBasisPoints ?? null,
      taxAccountingCode: accountingSnapshot.taxAccountingCode,
      taxPolicyRecordId: accountingSnapshot.taxPolicyRecordId,
      currencyAccountingCode: accountingSnapshot.currencyAccountingCode,
      quotationCurrencyRecordId: accountingSnapshot.quotationCurrencyRecordId,
      paymentTerms: header.paymentTerms,
      documentDiscountKind: header.documentDiscountKind,
      documentDiscountInputExact: header.documentDiscountInputExact,
      grossExact: header.grossExact,
      lineDiscountExact: header.lineDiscountExact,
      documentDiscountExact: header.documentDiscountExact,
      netExact: header.netExact,
      taxExact: header.taxExact,
      // Absent duty stays null so a document saved before the split keeps exactly
      // the breakdown it had; zero is written only when the app declared it.
      dutyExact: header.dutyExact ?? null,
      roundingExact: header.roundingExact,
      totalExact: header.totalExact,
      roundingRuleCode: header.roundingRuleCode ?? null,
      roundingRuleName: header.roundingRuleName ?? null,
      roundingStepRials: header.roundingStepRials ?? null,
      preRoundTotalExact: header.preRoundTotalExact ?? null,
      roundingRuleRecordId: header.roundingRuleRecordId ?? null,
      customerName,
      totalDisplay: formatExactAmountWithCurrency(
        header.totalExact,
        resolveCurrencyLabel(header.currencyCode),
      ),
      ...commercialColumnsFromDraftHeader(header),
    };
  }

  private buildLineColumns(
    line: QuotationDraftSaveLine,
    sortOrder: number,
    taxSnapshot: LineAccountingSnapshot,
    documentCurrencyCode?: string,
  ): Record<string, unknown> {
    // WS4: every line inherits the document currency; no independent line picker.
    const inheritedCurrency =
      (documentCurrencyCode ?? '').trim().toUpperCase() ||
      (line.currencyCode ?? '').trim().toUpperCase() ||
      null;

    return {
      name: line.name,
      kind: line.kind,
      description: line.description,
      unit: taxSnapshot.unit,
      unitRecordId: taxSnapshot.unitRecordId,
      unitCode: taxSnapshot.unitCode,
      unitAccountingCode: taxSnapshot.unitAccountingCode,
      quantityExact: line.quantityExact,
      unitPriceExact: line.unitPriceExact,
      grossExact: line.grossExact,
      discountExact: line.discountExact,
      discountKind: line.discountKind,
      discountInputExact: line.discountInputExact,
      documentDiscountExact: line.documentDiscountExact,
      taxExact: line.taxExact,
      totalExact: line.totalExact,
      taxPolicy: line.taxPolicy ?? null,
      taxRateBasisPoints: line.taxRateBasisPoints ?? null,
      dutyRateBasisPoints: line.dutyRateBasisPoints ?? null,
      taxAccountingCode: taxSnapshot?.taxAccountingCode ?? '',
      taxPolicyRecordId: taxSnapshot?.taxPolicyRecordId ?? null,
      currencyCode: inheritedCurrency,
      sortOrder,
      // Keep Twenty's list `position` aligned with document order so multi-line
      // drafts do not all land at position 0 in object views.
      position: sortOrder,
      itemId: line.itemId,
      selectedPriceListId: line.selectedPriceListId ?? null,
      selectedPriceId: line.selectedPriceId ?? null,
      selectedPriceValidFrom: line.selectedPriceValidFrom ?? null,
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
        .findOne({ where: { id: header.personId } });

      if (!isDefined(person)) {
        return null;
      }

      const firstName = isNonEmptyString(person.name?.firstName)
        ? person.name.firstName
        : '';
      const lastName = isNonEmptyString(person.name?.lastName)
        ? person.name.lastName
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
