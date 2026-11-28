import {
  buildCatalogItemUpsertPlan,
  type CatalogItemUpsertInput,
  type CatalogItemUpsertPlan,
} from 'src/domain/catalog/catalog-upsert';
import {
  buildDraftQuotationPlan,
  type DraftQuotationInput,
  type DraftQuotationPlan,
} from 'src/domain/quotation/draft-quotation';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { type AtomicSaveRequest } from 'src/data/atomic-draft-save-api';

// Persistence is prepared here as GraphQL mutation documents. Execution requires an
// installed app and a live token; S2 ships the code but does not install or call Asan.

export type SaveDraftOutcome =
  | { kind: 'VALIDATED'; plan: DraftQuotationPlan }
  | { kind: 'SAVED'; quotationId: string; version: number; plan: DraftQuotationPlan }
  | { kind: 'REJECTED'; code: string; message: string };

export type SaveCatalogOutcome =
  | { kind: 'VALIDATED'; plan: CatalogItemUpsertPlan }
  | { kind: 'SAVED'; itemId: string; plan: CatalogItemUpsertPlan }
  | { kind: 'REJECTED'; code: string; message: string };

export const validateDraftQuotation = (
  input: DraftQuotationInput,
): SaveDraftOutcome => {
  const plan = buildDraftQuotationPlan(input);

  if (!plan.ok) {
    return {
      kind: 'REJECTED',
      code: plan.refusal.code,
      message: plan.refusal.detail,
    };
  }

  return { kind: 'VALIDATED', plan: plan.value };
};

export const validateCatalogItemUpsert = (
  input: CatalogItemUpsertInput,
): SaveCatalogOutcome => {
  const plan = buildCatalogItemUpsertPlan(input);

  if (!plan.ok) {
    return {
      kind: 'REJECTED',
      code: plan.refusal.code,
      message: plan.refusal.detail,
    };
  }

  return { kind: 'VALIDATED', plan: plan.value };
};

// Builds the createQuotation + createQuotationLine mutation bodies. Callers that
// have a live GraphQL client execute them; unit tests assert the shape only.
export const buildDraftQuotationWritePayload = (
  plan: DraftQuotationPlan,
): Result<{
  quotation: Record<string, unknown>;
  lines: Record<string, unknown>[];
}> => {
  if (plan.lines.length === 0) {
    return refused('DOCUMENT_HAS_NO_LINES', 'حداقل یک ردیف لازم است');
  }

  return accepted({
    quotation: {
      name: plan.name,
      status: plan.status,
      customerType: plan.customerType,
      personId: plan.personId,
      companyId: plan.companyId,
      currencyCode: plan.currencyCode,
      taxPolicy: plan.taxPolicy,
      paymentTerms: plan.paymentTerms,
      grossExact: plan.totalsExact.grossExact,
      lineDiscountExact: plan.totalsExact.lineDiscountExact,
      documentDiscountExact: plan.totalsExact.documentDiscountExact,
      documentDiscountKind: plan.documentDiscountKind,
      documentDiscountInputExact: plan.documentDiscountInputExact,
      netExact: plan.totalsExact.netExact,
      taxExact: plan.totalsExact.taxExact,
      roundingExact: plan.totalsExact.roundingExact,
      totalExact: plan.totalExact,
      roundingRuleCode: plan.roundingRuleCode,
      roundingRuleName: plan.roundingRuleName,
      roundingStepRials: plan.roundingStepRials,
      preRoundTotalExact: plan.preRoundTotalExact,
      roundingRuleRecordId: plan.roundingRuleRecordId,
      version: plan.version,
    },
    lines: plan.lines.map((line) => ({
      name: line.name,
      kind: line.kind,
      description: line.description,
      unit: line.unit,
      unitRecordId: line.unitRecordId ?? null,
      quantityExact: line.quantityExact,
      unitPriceExact: line.unitPriceExact,
      grossExact: line.grossExact,
      discountExact: line.discountExact,
      discountKind: line.discountKind,
      discountInputExact: line.discountInputExact,
      documentDiscountExact: line.documentDiscountExact,
      taxExact: line.taxExact,
      totalExact: line.totalExact,
      sortOrder: line.sortOrder,
      itemId: line.catalogItemId,
    })),
  });
};

// Shape of the one atomic save call. Header and lines travel together so the
// backend can write them in a single transaction; nothing here is persisted on its
// own.
export const buildDraftQuotationSaveRequest = (
  plan: DraftQuotationPlan,
  expectedVersion: number | null,
): AtomicSaveRequest => ({
  quotationId: plan.quotationId,
  expectedVersion,
  header: {
    name: plan.name,
    customerType: plan.customerType,
    personId: plan.personId,
    companyId: plan.companyId,
    currencyCode: plan.currencyCode,
    taxPolicy: plan.taxPolicy,
    taxRateBasisPoints: plan.taxRateBasisPoints,
    dutyRateBasisPoints: plan.dutyRateBasisPoints,
    paymentTerms: plan.paymentTerms,
    documentDiscountKind: plan.documentDiscountKind,
    documentDiscountInputExact: plan.documentDiscountInputExact,
    grossExact: plan.totalsExact.grossExact,
    lineDiscountExact: plan.totalsExact.lineDiscountExact,
    documentDiscountExact: plan.totalsExact.documentDiscountExact,
    netExact: plan.totalsExact.netExact,
    taxExact: plan.totalsExact.taxExact,
    dutyExact: plan.dutyExact,
    roundingExact: plan.totalsExact.roundingExact,
    totalExact: plan.totalExact,
    roundingRuleCode: plan.roundingRuleCode,
    roundingRuleName: plan.roundingRuleName,
    roundingStepRials: plan.roundingStepRials,
    preRoundTotalExact: plan.preRoundTotalExact,
    roundingRuleRecordId: plan.roundingRuleRecordId,
  },
  lines: plan.lines.map((line) => ({
    name: line.name,
    kind: line.kind,
    description: line.description,
    unit: line.unit,
    unitRecordId: line.unitRecordId ?? null,
    quantityExact: line.quantityExact,
    unitPriceExact: line.unitPriceExact,
    grossExact: line.grossExact,
    discountExact: line.discountExact,
    discountKind: line.discountKind,
    discountInputExact: line.discountInputExact,
    documentDiscountExact: line.documentDiscountExact,
    taxExact: line.taxExact,
    totalExact: line.totalExact,
    itemId: line.catalogItemId,
    sortOrder: line.sortOrder,
    taxPolicy: line.taxPolicy,
    taxRateBasisPoints: line.taxRateBasisPoints,
    dutyRateBasisPoints: line.dutyRateBasisPoints,
    currencyCode: line.currencyCode,
  })),
});

export const buildCatalogItemWritePayload = (
  plan: CatalogItemUpsertPlan,
): Result<{
  item: Record<string, unknown>;
  defaultUnitPriceExact: string | null;
}> =>
  accepted({
    item: {
      name: plan.item.name,
      kind: plan.item.kind,
      sku: plan.item.sku,
      unit: plan.item.unit,
      unitRecordId: plan.unitRecordId,
      secondaryName: plan.secondaryName,
      isActive: plan.item.isActive,
    },
    defaultUnitPriceExact: plan.defaultUnitPriceExact,
  });
