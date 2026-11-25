import { Injectable } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import {
  type QuotationPdfInput,
  type QuotationPdfLine,
} from 'src/modules/quotation/pdf/quotation-pdf-document';
import { renderQuotationPdf } from 'src/modules/quotation/pdf/render-quotation-pdf';
import {
  formatExactAmountWithCurrency,
  formatExactAmountForDisplay,
  formatBasisPointsAsPersianPercent,
  formatJalaliDateFromInstant,
  isSignificantExactAmount,
  resolveCurrencyLabel,
  subtractExactAmounts,
  toPersianDigits,
} from 'src/modules/quotation/utils/quotation-pdf-display.util';

type QuotationPdfRow = {
  id: string;
  name: string | null;
  quotationNumber: string | null;
  grossExact: string | null;
  lineDiscountExact: string | null;
  documentDiscountExact: string | null;
  netExact: string | null;
  taxExact: string | null;
  taxRateBasisPoints: string | null;
  dutyExact: string | null;
  dutyRateBasisPoints: string | null;
  roundingExact: string | null;
  roundingStepRials: string | null;
  totalExact: string | null;
  paymentTerms: string | null;
  currencyCode: string | null;
  personId: string | null;
  companyId: string | null;
  sentAt: string | Date | null;
  customerType: string | null;
};

type QuotationLinePdfRow = {
  id: string;
  name: string | null;
  description: string | null;
  quantityExact: string | null;
  unitPriceExact: string | null;
  discountExact: string | null;
  taxExact: string | null;
  totalExact: string | null;
  sortOrder: number | null;
};

type PersonNameRow = {
  id: string;
  name: { firstName: string | null; lastName: string | null } | null;
};

type CompanyNameRow = {
  id: string;
  name: string | null;
};

export type QuotationPdfResult = {
  buffer: Buffer;
  fileName: string;
};

const LINE_DESCRIPTION_FALLBACK = '—';

@Injectable()
export class QuotationPdfService {
  constructor(private readonly workspaceOrmManager: WorkspaceOrmManager) {}

  async generateQuotationPdf({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<QuotationPdfResult> {
    const { quotation, lines, customerName } = await this.loadQuotationContext(
      authContext,
      quotationId,
    );

    const currencyLabel = resolveCurrencyLabel(quotation.currencyCode);
    const pdfInput = this.buildPdfInput({
      quotation,
      lines,
      customerName,
      currencyLabel,
    });
    const buffer = await renderQuotationPdf(pdfInput);
    const fileName = this.buildFileName(quotation);

    return { buffer, fileName };
  }

  private async loadQuotationContext(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<{
    quotation: QuotationPdfRow;
    lines: QuotationLinePdfRow[];
    customerName: string;
  }> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const quotationRepository =
        this.workspaceOrmManager.getRepository<QuotationPdfRow>('quotation', {
          shouldBypassPermissionChecks: true,
        });
      const quotation = await quotationRepository.findOne({
        where: { id: quotationId },
        select: {
          id: true,
          name: true,
          quotationNumber: true,
          grossExact: true,
          lineDiscountExact: true,
          documentDiscountExact: true,
          netExact: true,
          taxExact: true,
          taxRateBasisPoints: true,
          dutyExact: true,
          dutyRateBasisPoints: true,
          roundingExact: true,
          roundingStepRials: true,
          totalExact: true,
          paymentTerms: true,
          currencyCode: true,
          personId: true,
          companyId: true,
          sentAt: true,
          customerType: true,
        },
      });

      if (!isDefined(quotation)) {
        throw new QuotationQueryValidationException(
          'quotation not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      const lineRepository =
        this.workspaceOrmManager.getRepository<QuotationLinePdfRow>(
          'quotationLine',
          { shouldBypassPermissionChecks: true },
        );
      const lines = await lineRepository.find({
        where: { quotationId },
        select: {
          id: true,
          name: true,
          description: true,
          quantityExact: true,
          unitPriceExact: true,
          discountExact: true,
          taxExact: true,
          totalExact: true,
          sortOrder: true,
        },
        order: { sortOrder: 'ASC' },
      });

      const customerName = await this.resolveCustomerName(quotation);

      return { quotation, lines, customerName };
    }, authContext);
  }

  private async resolveCustomerName(
    quotation: QuotationPdfRow,
  ): Promise<string> {
    if (isNonEmptyString(quotation.companyId)) {
      const company = await this.workspaceOrmManager
        .getRepository<CompanyNameRow>('company', {
          shouldBypassPermissionChecks: true,
        })
        .findOne({
          where: { id: quotation.companyId },
          select: { id: true, name: true },
        });

      if (isNonEmptyString(company?.name)) {
        return company.name;
      }
    }

    if (isNonEmptyString(quotation.personId)) {
      const person = await this.workspaceOrmManager
        .getRepository<PersonNameRow>('person', {
          shouldBypassPermissionChecks: true,
        })
        .findOne({
          where: { id: quotation.personId },
        });

      // The ORM returns `name` as a composite object; the flat columns are not hydrated.
      const firstName = isNonEmptyString(person?.name?.firstName)
        ? person.name.firstName
        : '';
      const lastName = isNonEmptyString(person?.name?.lastName)
        ? person.name.lastName
        : '';
      const personName = `${firstName} ${lastName}`.trim();

      if (isNonEmptyString(personName)) {
        return personName;
      }
    }

    return '—';
  }

  private buildPdfInput({
    quotation,
    lines,
    customerName,
    currencyLabel,
  }: {
    quotation: QuotationPdfRow;
    lines: QuotationLinePdfRow[];
    customerName: string;
    currencyLabel: string;
  }): QuotationPdfInput {
    const title = isNonEmptyString(quotation.name)
      ? quotation.name
      : 'پیش‌فاکتور';
    const quotationNumber = isNonEmptyString(quotation.quotationNumber)
      ? toPersianDigits(quotation.quotationNumber)
      : toPersianDigits(quotation.id.slice(0, 8));

    const sentAt =
      quotation.sentAt instanceof Date
        ? quotation.sentAt.toISOString()
        : (quotation.sentAt ?? null);
    const jalaliDate =
      sentAt !== null
        ? (formatJalaliDateFromInstant(sentAt) ?? undefined)
        : undefined;

    const pdfLines = lines.map((line) =>
      this.mapLineToPdf(line, currencyLabel),
    );
    const total = isNonEmptyString(quotation.totalExact)
      ? formatExactAmountWithCurrency(quotation.totalExact, currencyLabel)
      : formatExactAmountWithCurrency('0.000000', currencyLabel);

    const formatStored = (value: string | null | undefined) =>
      isNonEmptyString(value) && isSignificantExactAmount(value)
        ? formatExactAmountWithCurrency(value, currencyLabel)
        : undefined;

    // The stored tax is tax + duty. Showing that sum under "مالیات" while also showing
    // a duty row would count duty twice, so the tax row gets the exact remainder. Both
    // figures come from stored amounts; nothing is re-derived here.
    const taxOnlyExact =
      quotation.dutyExact === null || quotation.dutyExact === undefined
        ? quotation.taxExact
        : subtractExactAmounts(quotation.taxExact, quotation.dutyExact);

    return {
      title,
      quotationNumber,
      customerName,
      jalaliDate,
      paymentTerms: isNonEmptyString(quotation.paymentTerms)
        ? quotation.paymentTerms
        : undefined,
      currencyLabel,
      lines: pdfLines,
      // Stored breakdown only — never recompute money in the PDF layer.
      subtotals: {
        gross: formatStored(quotation.grossExact),
        lineDiscount: formatStored(quotation.lineDiscountExact),
        documentDiscount: formatStored(quotation.documentDiscountExact),
        net: formatStored(quotation.netExact),
        tax: formatStored(taxOnlyExact),
        taxRatePercent:
          formatBasisPointsAsPersianPercent(quotation.taxRateBasisPoints) ??
          undefined,
        duty: formatStored(quotation.dutyExact),
        dutyRatePercent:
          formatBasisPointsAsPersianPercent(quotation.dutyRateBasisPoints) ??
          undefined,
        rounding: formatStored(quotation.roundingExact),
        roundingStepLabel: isNonEmptyString(quotation.roundingStepRials)
          ? `مبنای ${toPersianDigits(quotation.roundingStepRials)} ریال`
          : undefined,
      },
      total,
    };
  }

  private mapLineToPdf(
    line: QuotationLinePdfRow,
    currencyLabel: string,
  ): QuotationPdfLine {
    const description = isNonEmptyString(line.description)
      ? line.description
      : isNonEmptyString(line.name)
        ? line.name
        : LINE_DESCRIPTION_FALLBACK;

    const quantity = isNonEmptyString(line.quantityExact)
      ? formatExactAmountForDisplay(line.quantityExact)
      : toPersianDigits('0');

    const unitPrice = isNonEmptyString(line.unitPriceExact)
      ? formatExactAmountWithCurrency(line.unitPriceExact, currencyLabel)
      : formatExactAmountWithCurrency('0.000000', currencyLabel);

    const pdfLine: QuotationPdfLine = {
      description,
      quantity,
      unitPrice,
    };

    if (isSignificantExactAmount(line.discountExact)) {
      pdfLine.discount = formatExactAmountWithCurrency(
        line.discountExact as string,
        currencyLabel,
      );
    }

    if (isSignificantExactAmount(line.taxExact)) {
      pdfLine.tax = formatExactAmountWithCurrency(
        line.taxExact as string,
        currencyLabel,
      );
    }

    if (isSignificantExactAmount(line.totalExact)) {
      pdfLine.lineTotal = formatExactAmountWithCurrency(
        line.totalExact as string,
        currencyLabel,
      );
    }

    return pdfLine;
  }

  private buildFileName(quotation: QuotationPdfRow): string {
    const stem = isNonEmptyString(quotation.quotationNumber)
      ? quotation.quotationNumber.replace(/[^\w.-]+/g, '_')
      : quotation.id;

    return `quotation-${stem}.pdf`;
  }
}
