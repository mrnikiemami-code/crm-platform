import { renderToBuffer } from '@react-pdf/renderer';

import {
  buildQuotationPdfDocument,
  type QuotationPdfInput,
} from 'src/modules/quotation/pdf/quotation-pdf-document';

export const renderQuotationPdf = (
  input: QuotationPdfInput,
): Promise<Buffer> => renderToBuffer(buildQuotationPdfDocument(input));