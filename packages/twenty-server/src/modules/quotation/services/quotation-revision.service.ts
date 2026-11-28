import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import {
  buildQuotationRevisionSnapshot,
  hashQuotationRevision,
  type QuotationRevisionHeaderRow,
  type QuotationRevisionLineRow,
  type SealedQuotationCustomer,
} from 'src/modules/quotation/utils/quotation-revision-snapshot.util';

type PartySealRow = {
  id: string;
  name?: string | { firstName?: string | null; lastName?: string | null } | null;
  nationalCode?: string | null;
  economicCode?: string | null;
  registrationNumber?: string | null;
  accountingCode?: string | null;
  customerCode?: string | null;
  accountingMobile?: string | null;
  accountingPhone?: string | null;
  accountingSecondPhone?: string | null;
  accountingFax?: string | null;
  accountingEmail?: string | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  address?: Record<string, unknown> | null;
  accountingAddress?: Record<string, unknown> | null;
};

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const buildCustomerSeal = async (scope: WorkspaceTransactionScope, header: QuotationRevisionHeaderRow): Promise<SealedQuotationCustomer> => {
  const id = header.companyId ?? header.personId;
  if (!id || (!!header.companyId === !!header.personId)) {
    throw new QuotationQueryValidationException('REVISION_MISMATCH: exactly one customer is required', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
  const company = !!header.companyId;
  const row = await scope.getRepository<PartySealRow>(company ? 'company' : 'person', {
    shouldBypassPermissionChecks: true,
  }).findOne({ where: { id } });
  const nativeName = typeof row?.name === 'string' ? row.name :
    [row?.name?.firstName, row?.name?.lastName].filter(Boolean).join(' ');
  const name = optionalText(nativeName);
  if (!row || row.id !== id || !name) {
    throw new QuotationQueryValidationException('REVISION_MISMATCH: customer identity is unavailable', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
  const address = company ? row.address : row.accountingAddress;
  return {
    id,
    kind: company ? 'COMPANY' : 'PERSON',
    name,
    nationalCode: optionalText(row.nationalCode),
    economicCode: optionalText(row.economicCode),
    registrationNumber: company ? optionalText(row.registrationNumber) : null,
    accountingCode: optionalText(row.accountingCode),
    customerCode: optionalText(row.customerCode),
    mobile: optionalText(company ? row.accountingMobile : row.phones?.primaryPhoneNumber),
    phone: optionalText(row.accountingPhone),
    secondPhone: optionalText(row.accountingSecondPhone),
    fax: optionalText(row.accountingFax),
    email: optionalText(company ? row.accountingEmail : row.emails?.primaryEmail),
    address: {
      street1: optionalText(address?.addressStreet1),
      street2: optionalText(address?.addressStreet2),
      city: optionalText(address?.addressCity),
      state: optionalText(address?.addressState),
      postcode: optionalText(address?.addressPostcode),
      country: optionalText(address?.addressCountry),
    },
  };
};

type QuotationRevisionRow = {
  id: string;
  version: number | null;
  status: string | null;
};

type SealedRevision = {
  revisionId: string;
  version: number;
  snapshotHash: string;
};

// Sealing happens inside the same transaction that flips the status and allocates the
// number, so a quotation can never be observed as issued without the bytes the customer
// was shown.
//
// WHY "IF MISSING" AND NOT "ON EVERY APPROVAL": the content is frozen once issued, so a
// second revision for the same approved content would be a second identity for one
// document. The check also backfills quotations that were approved before revisions were
// written, the first time they move through an issued state.
@Injectable()
export class QuotationRevisionService {
  async sealIfMissing({
    transactionScope,
    quotationId,
    issuedBy,
    issuedAt,
  }: {
    transactionScope: WorkspaceTransactionScope;
    quotationId: string;
    issuedBy: string | null;
    issuedAt: Date;
  }): Promise<SealedRevision | null> {
    const revisionRepository =
      transactionScope.getRepository<QuotationRevisionRow>(
        'quotationRevision',
        {
          shouldBypassPermissionChecks: true,
        },
      );

    const existingRevisions = await revisionRepository.find({
      where: { quotationId },
      select: { id: true, version: true, status: true },
    });

    if (existingRevisions.some((revision) => revision.status === 'ISSUED')) {
      return null;
    }

    const headerRepository = transactionScope.getRepository<
      QuotationRevisionHeaderRow & { version: number | null }
    >('quotation', { shouldBypassPermissionChecks: true });

    const header = await headerRepository.findOne({
      where: { id: quotationId },
      select: {
        id: true,
        version: true,
        quotationNumber: true,
        name: true,
        expiresAt: true,
        taxPolicyRecordId: true,
        taxAccountingCode: true,
        quotationCurrencyRecordId: true,
        currencyAccountingCode: true,
        currencyCode: true,
        taxPolicy: true,
        taxRateBasisPoints: true,
        dutyRateBasisPoints: true,
        paymentTerms: true,
        grossExact: true,
        lineDiscountExact: true,
        documentDiscountExact: true,
        netExact: true,
        taxExact: true,
        dutyExact: true,
        roundingExact: true,
        roundingRuleCode: true,
        roundingRuleName: true,
        roundingStepRials: true,
        preRoundTotalExact: true,
        totalExact: true,
        personId: true,
        companyId: true,
      },
    });

    if (!isDefined(header)) {
      throw new QuotationQueryValidationException(
        'quotation not found while sealing its revision',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const lineRepository =
      transactionScope.getRepository<QuotationRevisionLineRow>(
        'quotationLine',
        { shouldBypassPermissionChecks: true },
      );

    const lines = await lineRepository.find({
      where: { quotationId },
      select: {
        id: true,
        description: true,
        name: true,
        kind: true,
        itemId: true,
        taxPolicyRecordId: true,
        taxAccountingCode: true,
        unit: true,
        quantityExact: true,
        unitPriceExact: true,
        grossExact: true,
        discountExact: true,
        documentDiscountExact: true,
        taxExact: true,
        totalExact: true,
        taxPolicy: true,
        taxRateBasisPoints: true,
        dutyRateBasisPoints: true,
      },
      order: { sortOrder: 'ASC' },
    });

    // The status/version UPDATE has already executed in this transaction.
    const version = header.version ?? 0;
    const revisionVersion =
      existingRevisions.reduce(
        (highest, revision) => Math.max(highest, revision.version ?? 0),
        0,
      ) + 1;

    const customer = await buildCustomerSeal(transactionScope, header);
    const itemIds = [...new Set(lines.flatMap((line) => line.itemId ? [line.itemId] : []))];
    const items = itemIds.length === 0 ? [] :
      await transactionScope.getRepository<{ id: string; sku: string | null; accountingCode: string | null }>(
        'catalogItem', { shouldBypassPermissionChecks: true },
      ).find({ where: { id: In(itemIds) }, select: { id: true, sku: true, accountingCode: true } });
    const itemById = new Map(items.map((item) => [item.id, item]));
    if (itemIds.some((id) => !itemById.has(id))) {
      throw new QuotationQueryValidationException('REVISION_MISMATCH: a referenced item is unavailable', QuotationQueryValidationExceptionCode.FORBIDDEN);
    }
    const built = buildQuotationRevisionSnapshot({
      header,
      lines: lines.map((line) => {
        const item = line.itemId ? itemById.get(line.itemId) : undefined;
        return { ...line, itemSku: item?.sku ?? null, itemAccountingCode: item?.accountingCode ?? null };
      }),
      version,
      issuedAt,
      identity: { revisionNumber: revisionVersion, customer },
    });

    if (!built.ok) {
      // Sealing inconsistent numbers would preserve a document nobody can reproduce, so
      // the transition is refused and the quotation stays as it was.
      throw new QuotationQueryValidationException(
        `${built.code}: ${built.detail}`,
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const snapshotHash = hashQuotationRevision(built.snapshot);
    const inserted = await revisionRepository.insert({
      name: `${built.snapshot.quotationNumber} v${revisionVersion}`,
      version: revisionVersion,
      status: 'ISSUED',
      snapshotJson: built.snapshot,
      snapshotHash,
      // Record columns use exact decimal IRR; only the hashed seal uses integer micros.
      totalExact: header.totalExact as string,
      issuedAt,
      issuedBy,
      quotationId,
    });

    const revisionId = inserted.identifiers[0]?.id;

    if (typeof revisionId !== 'string') {
      throw new QuotationQueryValidationException(
        'revision was built but could not be stored',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    return { revisionId, version: revisionVersion, snapshotHash };
  }
}
