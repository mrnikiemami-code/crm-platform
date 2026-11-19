import {
  buildDraftQuotationPlan,
  type DraftLineInput,
  type DraftQuotationInput,
  type DraftQuotationPlan,
} from 'src/domain/quotation/draft-quotation';
import { type Result } from 'src/domain/shared/result';

export type DraftLinePreview = {
  clientLineId: string;
  ok: boolean;
  detail: string | null;
};

export type DraftQuotationPreview = {
  linePreviews: DraftLinePreview[];
  // Totals from currently valid lines only (for live summary).
  partialPlan: Result<DraftQuotationPlan> | null;
  // Full-document plan; required for save.
  fullPlan: Result<DraftQuotationPlan>;
  canSave: boolean;
};

const isLineStructurallyEmpty = (line: DraftLineInput): boolean =>
  line.name.trim() === '' &&
  line.unitPriceText.trim() === '' &&
  (line.catalogItemId === null || line.catalogItemId === '');

export const buildDraftQuotationPreview = (
  input: DraftQuotationInput,
): DraftQuotationPreview => {
  const linePreviews: DraftLinePreview[] = input.lines.map((line) => {
    const single = buildDraftQuotationPlan({
      ...input,
      lines: [line],
      documentDiscount: { kind: 'NONE' },
    });

    if (single.ok) {
      return { clientLineId: line.clientLineId, ok: true, detail: null };
    }

    if (isLineStructurallyEmpty(line)) {
      return {
        clientLineId: line.clientLineId,
        ok: false,
        detail: 'کالا یا خدمت را انتخاب کنید',
      };
    }

    return {
      clientLineId: line.clientLineId,
      ok: false,
      detail: single.refusal.detail,
    };
  });

  const validLines = input.lines.filter(
    (_line, index) => linePreviews[index].ok,
  );

  const partialPlan =
    validLines.length === 0
      ? null
      : buildDraftQuotationPlan({
          ...input,
          lines: validLines,
        });

  const fullPlan = buildDraftQuotationPlan(input);
  const canSave =
    fullPlan.ok &&
    linePreviews.every((preview) => preview.ok) &&
    input.lines.length > 0;

  return {
    linePreviews,
    partialPlan,
    fullPlan,
    canSave,
  };
};
