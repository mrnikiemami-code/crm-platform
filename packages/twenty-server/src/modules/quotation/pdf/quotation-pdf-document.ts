import { createElement, type ReactElement } from 'react';

import {
  Document,
  type DocumentProps,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from '@react-pdf/renderer';
import { isNonEmptyString } from '@sniptt/guards';

import { applyPersianPdfTextLayerFixes } from 'src/modules/quotation/pdf/fontkit-zwnj-preservation';
import { resolvePersianFont } from 'src/modules/quotation/pdf/persian-font';

// createElement instead of JSX because the twenty-server build compiles with tsx disabled.

export const QUOTATION_PDF_FONT_FAMILY = 'QuotationPersian';

let fontsRegistered = false;

export const registerQuotationPdfFont = (): void => {
  applyPersianPdfTextLayerFixes();

  if (fontsRegistered) {
    return;
  }

  const font = resolvePersianFont();

  Font.register({
    family: QUOTATION_PDF_FONT_FAMILY,
    fonts: [
      {
        src: `data:font/ttf;base64,${font.bytes.toString('base64')}`,
      },
    ],
  });

  fontsRegistered = true;
};

const RTL_TEXT_STYLE = { direction: 'rtl' as const, textAlign: 'right' as const };

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: QUOTATION_PDF_FONT_FAMILY,
    lineHeight: 1.6,
    color: '#1a1a1a',
  },
  heading: { fontSize: 16, marginBottom: 6, textAlign: 'right' },
  meta: { fontSize: 9, color: '#555555', marginBottom: 6, textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 2,
  },
  cellNarrow: { textAlign: 'center', paddingHorizontal: 3 },
  cellMoney: { textAlign: 'left', paddingHorizontal: 3 },
  cellDescription: { textAlign: 'right', paddingHorizontal: 4 },
  subtotalRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 2,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
  },
  totalLabel: { width: '60%', textAlign: 'right', paddingHorizontal: 4 },
  totalValue: { width: '40%', textAlign: 'left', paddingHorizontal: 4 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
  },
});

export type QuotationPdfLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  discount?: string;
  tax?: string;
  lineTotal?: string;
};

export type QuotationPdfSubtotals = {
  gross?: string;
  discount?: string;
  net?: string;
  tax?: string;
};

export type QuotationPdfInput = {
  title: string;
  quotationNumber: string;
  customerName: string;
  jalaliDate?: string;
  paymentTerms?: string;
  currencyLabel: string;
  lines: QuotationPdfLine[];
  subtotals?: QuotationPdfSubtotals;
  total: string;
};

type TableLayout = {
  descriptionWidth: string;
  narrowWidth: string;
  showDiscount: boolean;
  showTax: boolean;
  showLineTotal: boolean;
};

const resolveTableLayout = (lines: QuotationPdfLine[]): TableLayout => {
  const showDiscount = lines.some((line) => isNonEmptyString(line.discount));
  const showTax = lines.some((line) => isNonEmptyString(line.tax));
  const showLineTotal = lines.some((line) => isNonEmptyString(line.lineTotal));
  const narrowColumnCount =
    1 + // quantity
    1 + // unit price
    (showDiscount ? 1 : 0) +
    (showTax ? 1 : 0) +
    (showLineTotal ? 1 : 0);
  const narrowTotalPercent = Math.min(55, narrowColumnCount * 11);
  const descriptionWidth = `${100 - narrowTotalPercent}%`;
  const narrowWidth = `${narrowTotalPercent / narrowColumnCount}%`;

  return {
    descriptionWidth,
    narrowWidth,
    showDiscount,
    showTax,
    showLineTotal,
  };
};

const tableCell = (
  baseStyle: ViewProps['style'],
  text: string,
  key?: string,
): ReactElement =>
  createElement(
    View,
    { style: baseStyle, ...(key === undefined ? {} : { key }) },
    createElement(Text, { style: RTL_TEXT_STYLE }, text),
  );

const buildMetaLines = (input: QuotationPdfInput): string[] => {
  const lines: string[] = [
    `شماره ${input.quotationNumber} — ${input.customerName}`,
  ];

  if (isNonEmptyString(input.jalaliDate)) {
    lines.push(`تاریخ ${input.jalaliDate}`);
  }

  if (isNonEmptyString(input.paymentTerms)) {
    lines.push(`شرایط پرداخت: ${input.paymentTerms}`);
  }

  return lines;
};

const buildSubtotalRows = (
  subtotals: QuotationPdfSubtotals,
): { label: string; value: string }[] => {
  const rows: { label: string; value: string }[] = [];

  if (isNonEmptyString(subtotals.gross)) {
    rows.push({ label: 'جمع ناخالص', value: subtotals.gross });
  }

  if (isNonEmptyString(subtotals.discount)) {
    rows.push({ label: 'تخفیف', value: subtotals.discount });
  }

  if (isNonEmptyString(subtotals.net)) {
    rows.push({ label: 'خالص', value: subtotals.net });
  }

  if (isNonEmptyString(subtotals.tax)) {
    rows.push({ label: 'مالیات', value: subtotals.tax });
  }

  return rows;
};

export const buildQuotationPdfDocument = (
  input: QuotationPdfInput,
): ReactElement<DocumentProps> => {
  registerQuotationPdfFont();

  const layout = resolveTableLayout(input.lines);
  const descriptionStyle = {
    ...styles.cellDescription,
    width: layout.descriptionWidth,
  };
  const narrowStyle = { ...styles.cellNarrow, width: layout.narrowWidth };
  const moneyStyle = { ...styles.cellMoney, width: layout.narrowWidth };

  const headerChildren: ReactElement[] = [
    tableCell(descriptionStyle, 'شرح کالا یا خدمت', 'hdr-desc'),
    tableCell(narrowStyle, 'تعداد', 'hdr-qty'),
    tableCell(moneyStyle, 'قیمت واحد', 'hdr-unit'),
  ];

  if (layout.showDiscount) {
    headerChildren.push(tableCell(moneyStyle, 'تخفیف', 'hdr-disc'));
  }

  if (layout.showTax) {
    headerChildren.push(tableCell(moneyStyle, 'مالیات', 'hdr-tax'));
  }

  if (layout.showLineTotal) {
    headerChildren.push(tableCell(moneyStyle, 'جمع ردیف', 'hdr-line-total'));
  }

  const lineRows = input.lines.map((line, index) => {
    const cells: ReactElement[] = [
      tableCell(descriptionStyle, line.description, `line-${index}-desc`),
      tableCell(narrowStyle, line.quantity, `line-${index}-qty`),
      tableCell(moneyStyle, line.unitPrice, `line-${index}-unit`),
    ];

    if (layout.showDiscount) {
      cells.push(
        tableCell(
          moneyStyle,
          isNonEmptyString(line.discount) ? line.discount : '—',
          `line-${index}-disc`,
        ),
      );
    }

    if (layout.showTax) {
      cells.push(
        tableCell(
          moneyStyle,
          isNonEmptyString(line.tax) ? line.tax : '—',
          `line-${index}-tax`,
        ),
      );
    }

    if (layout.showLineTotal) {
      cells.push(
        tableCell(
          moneyStyle,
          isNonEmptyString(line.lineTotal) ? line.lineTotal : '—',
          `line-${index}-total`,
        ),
      );
    }

    return createElement(
      View,
      { key: `line-row-${index}`, style: styles.tableRow },
      ...cells,
    );
  });

  const subtotalRows =
    input.subtotals === undefined
      ? []
      : buildSubtotalRows(input.subtotals).map((row, index) =>
          createElement(
            View,
            { key: `subtotal-${index}`, style: styles.subtotalRow },
            tableCell(
              { ...styles.totalLabel, width: layout.descriptionWidth },
              row.label,
            ),
            tableCell(
              { ...styles.totalValue, width: narrowStyle.width },
              row.value,
            ),
          ),
        );

  // pdf.js does not read our generation-time ZWNJ CMap; browser copy/paste can still drop U+200C.
  const footerNote = 'این پیش\u200cفاکتور سند مالی نیست';

  return createElement(
    Document,
    {
      title: input.title,
      author: 'Twenty',
      subject: input.quotationNumber,
    },
    createElement(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      createElement(Text, { style: [styles.heading, RTL_TEXT_STYLE] }, input.title),
      ...buildMetaLines(input).map((line, index) =>
        createElement(
          Text,
          { key: `meta-${index}`, style: [styles.meta, RTL_TEXT_STYLE] },
          line,
        ),
      ),
      createElement(View, { style: styles.tableHeader }, ...headerChildren),
      ...lineRows,
      ...subtotalRows,
      createElement(
        View,
        { style: styles.totalRow },
        tableCell(styles.totalLabel, 'جمع کل'),
        tableCell(styles.totalValue, input.total),
      ),
      createElement(
        Text,
        { style: styles.footer, fixed: true },
        footerNote,
      ),
    ),
  ) as ReactElement<DocumentProps>;
};