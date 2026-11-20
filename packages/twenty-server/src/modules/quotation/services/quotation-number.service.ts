import { Injectable, Logger } from '@nestjs/common';

import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import {
  QUOTATION_NUMBER_WIDTH,
  QUOTATION_SEQUENCE_DOCUMENT_TYPE,
  buildQuotationSequenceScopeKey,
  formatQuotationNumber,
  readSequenceWidth,
  resolveQuotationFiscalYear,
} from 'src/modules/quotation/utils/quotation-numbering.util';

export type QuotationNumberAllocation = {
  quotationNumber: string;
  sequence: number;
};

// The number is allocated inside the transaction that also flips the status, so a
// quotation cannot be observed as issued without its number, and a failed status
// write does not burn a number that no document carries.
//
// The counter is claimed by ONE statement: `INSERT ... ON CONFLICT DO UPDATE ...
// RETURNING`. Read-then-write would leave a window where two issuers read the same
// `lastIssued`; the conflict clause makes the database do the increment under the
// row lock and hands back the value that won.
@Injectable()
export class QuotationNumberService {
  private readonly logger = new Logger(QuotationNumberService.name);

  async allocateQuotationNumber({
    transactionScope,
    issuedAt,
  }: {
    transactionScope: WorkspaceTransactionScope;
    issuedAt: Date;
  }): Promise<QuotationNumberAllocation | null> {
    const fiscalYear = resolveQuotationFiscalYear(issuedAt);

    if (fiscalYear === null) {
      this.logger.warn('Quotation number not allocated: unreadable issue date');

      return null;
    }

    if (!this.hasSequenceObject(transactionScope)) {
      return null;
    }

    const scopeKey = buildQuotationSequenceScopeKey(fiscalYear);
    const schemaName = getWorkspaceSchemaName(transactionScope.workspaceId);

    // `width` is only applied when the scope is created: a later allocation never
    // changes the shape of numbers already printed this year.
    const rows = await transactionScope.executeRawQuery(
      `INSERT INTO "${schemaName}"."_quotationSequence" AS sequence ("name", "scopeKey", "lastIssued", "width")
       VALUES ($1, $2, 1, $3)
       ON CONFLICT ("scopeKey") DO UPDATE
         SET "lastIssued" = sequence."lastIssued" + 1, "updatedAt" = now()
       RETURNING "lastIssued", "width"`,
      [
        `${QUOTATION_SEQUENCE_DOCUMENT_TYPE} ${fiscalYear}`,
        scopeKey,
        QUOTATION_NUMBER_WIDTH,
      ],
    );

    const claimed = rows[0];

    if (claimed === undefined) {
      this.logger.warn(
        `Quotation number not allocated: no sequence row returned for ${scopeKey}`,
      );

      return null;
    }

    const sequence = claimed.lastIssued;

    if (typeof sequence !== 'number' || !Number.isInteger(sequence)) {
      throw new Error(
        `QUOTATION_NUMBER_UNREADABLE: sequence for ${scopeKey} is not an integer`,
      );
    }

    const quotationNumber = formatQuotationNumber({
      fiscalYear,
      sequence,
      width: readSequenceWidth(claimed.width),
    });

    // Validated after the claim, so an unprintable sequence must fail loudly rather
    // than issue a document whose number silently changes shape.
    if (quotationNumber === null) {
      throw new Error(
        `QUOTATION_NUMBER_EXCEEDS_WIDTH: sequence ${sequence} cannot be printed for ${scopeKey}`,
      );
    }

    return { quotationNumber, sequence };
  }

  private hasSequenceObject(
    transactionScope: WorkspaceTransactionScope,
  ): boolean {
    try {
      // Metadata is generated from the live table, so a registered object means the
      // table exists. Without it the workspace has no quotation app: nothing to number.
      transactionScope.getRepository('quotationSequence', {
        shouldBypassPermissionChecks: true,
      });

      return true;
    } catch {
      this.logger.warn(
        'Quotation number not allocated: quotationSequence object is unavailable',
      );

      return false;
    }
  }
}
