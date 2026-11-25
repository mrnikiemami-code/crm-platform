import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

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
} from 'src/modules/quotation/utils/quotation-revision-snapshot.util';

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

    const version = (header.version ?? 0) + 1;
    const revisionVersion =
      existingRevisions.reduce(
        (highest, revision) => Math.max(highest, revision.version ?? 0),
        0,
      ) + 1;

    const built = buildQuotationRevisionSnapshot({
      header,
      lines,
      version,
      issuedAt,
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
      totalExact: built.snapshot.totals.totalMicros,
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
