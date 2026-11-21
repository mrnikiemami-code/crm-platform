import {
  buildAnyIrrPriceListQuery,
  buildCatalogItemByIdQuery,
  buildCreateCatalogItemMutation,
  buildCreatePriceListMutation,
  buildCreatePriceMutation,
  buildDefaultPriceListQuery,
  buildUpdateCatalogItemMutation,
} from 'src/data/quotation-queries';
import { type GraphqlValue } from 'src/data/graphql-literal';
import { RecordApiError } from 'src/data/record-api';
import {
  buildCatalogItemWritePayload,
  buildDraftQuotationSaveRequest,
  type SaveCatalogOutcome,
  type SaveDraftOutcome,
  validateCatalogItemUpsert,
  validateDraftQuotation,
} from 'src/services/quotation-save.service';
import { type CatalogItemUpsertInput } from 'src/domain/catalog/catalog-upsert';
import { type DraftQuotationInput } from 'src/domain/quotation/draft-quotation';
import {
  saveDraftAtomically,
  type AtomicSaveOutcome,
  type AtomicSaveRequest,
} from 'src/data/atomic-draft-save-api';
import { verifyCustomerRecord } from 'src/services/customer-picker.service';

export type PersistDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
};

export type DraftPersistDependencies = PersistDependencies & {
  saveDraftAtomically?: (
    request: AtomicSaveRequest,
  ) => Promise<AtomicSaveOutcome>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readCreatedId = (
  data: Record<string, unknown>,
  fieldName: string,
): string | null => {
  const node = asRecord(data[fieldName]);

  return typeof node?.id === 'string' ? node.id : null;
};

const readEdgesIds = (
  data: Record<string, unknown>,
  connectionName: string,
): string[] => {
  const connection = asRecord(data[connectionName]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    return typeof node?.id === 'string' ? [node.id] : [];
  });
};

const omitNullish = (
  data: Record<string, unknown>,
): Record<string, GraphqlValue> => {
  const next: Record<string, GraphqlValue> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }

    next[key] = value as GraphqlValue;
  }

  return next;
};

const ensureDefaultIrrPriceListId = async (
  execute: PersistDependencies['execute'],
): Promise<string> => {
  const preferred = await execute(buildDefaultPriceListQuery());
  const preferredId = readEdgesIds(preferred, 'priceLists')[0];

  if (preferredId) {
    return preferredId;
  }

  const anyIrr = await execute(buildAnyIrrPriceListQuery());
  const anyId = readEdgesIds(anyIrr, 'priceLists')[0];

  if (anyId) {
    return anyId;
  }

  const created = await execute(
    buildCreatePriceListMutation({
      name: 'نرخ فروش پیش‌فرض',
      currencyCode: 'IRR',
      isDefault: true,
    }),
  );
  const createdId = readCreatedId(created, 'createPriceList');

  if (!createdId) {
    throw new RecordApiError(
      'INVALID_RESPONSE',
      'Default price list was not created',
    );
  }

  return createdId;
};

export const persistCatalogItem = async (
  input: CatalogItemUpsertInput,
  dependencies: PersistDependencies,
): Promise<SaveCatalogOutcome> => {
  const outcome = validateCatalogItemUpsert(input);

  if (outcome.kind === 'REJECTED') {
    return outcome;
  }

  const payload = buildCatalogItemWritePayload(outcome.plan);

  if (!payload.ok) {
    return {
      kind: 'REJECTED',
      code: payload.refusal.code,
      message: payload.refusal.detail,
    };
  }

  const itemData = omitNullish(payload.value.item);

  try {
    let itemId: string | null = null;

    if (typeof input.id === 'string' && input.id.trim() !== '') {
      const existing = await dependencies.execute(
        buildCatalogItemByIdQuery(input.id),
      );
      const node = asRecord(existing.catalogItem);

      if (node === null) {
        return {
          kind: 'REJECTED',
          code: 'CATALOG_ITEM_NOT_FOUND',
          message: 'کالا یا خدمت برای ویرایش پیدا نشد',
        };
      }

      await dependencies.execute(
        buildUpdateCatalogItemMutation(input.id, itemData),
      );
      itemId = input.id;
    } else {
      const created = await dependencies.execute(
        buildCreateCatalogItemMutation(itemData),
      );
      itemId = readCreatedId(created, 'createCatalogItem');
    }

    if (!itemId) {
      return {
        kind: 'REJECTED',
        code: 'PERSISTENCE_FAILED',
        message: 'ذخیره کالا/خدمت انجام نشد',
      };
    }

    if (payload.value.defaultUnitPriceExact !== null) {
      const priceListId = await ensureDefaultIrrPriceListId(
        dependencies.execute,
      );

      await dependencies.execute(
        buildCreatePriceMutation({
          unitPriceExact: payload.value.defaultUnitPriceExact,
          itemId,
          priceListId,
        }),
      );
    }

    return { kind: 'SAVED', itemId, plan: outcome.plan };
  } catch (error) {
    if (error instanceof RecordApiError && error.code === 'FORBIDDEN') {
      return {
        kind: 'REJECTED',
        code: 'PERMISSION_DENIED',
        message: 'دسترسی لازم برای ذخیره کالا/خدمت وجود ندارد',
      };
    }

    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ذخیره کالا/خدمت انجام نشد',
    };
  }
};

export const persistDraftQuotation = async (
  input: DraftQuotationInput,
  dependencies: DraftPersistDependencies,
): Promise<SaveDraftOutcome> => {
  const outcome = validateDraftQuotation(input);

  if (outcome.kind === 'REJECTED') {
    return outcome;
  }

  const plan = outcome.plan;

  // Readable customer check before the transaction, so an unresolvable id returns
  // its specific refusal instead of a generic failure. The backend repeats the same
  // check inside the transaction; this is the message, not the guarantee.
  const customerCheck = await verifyCustomerRecord(
    {
      customerType: plan.customerType,
      recordId:
        (plan.customerType === 'PERSON' ? plan.personId : plan.companyId) ?? '',
    },
    dependencies,
  );

  if (!customerCheck.ok) {
    return {
      kind: 'REJECTED',
      code: customerCheck.refusal.code,
      message: customerCheck.refusal.detail,
    };
  }

  // One request, one transaction. Header, lines and totals are handed to the backend
  // together, so there is no partial-write window to recover from on this side.
  const saveDraft = dependencies.saveDraftAtomically ?? saveDraftAtomically;

  let saved: AtomicSaveOutcome;

  try {
    saved = await saveDraft(
      buildDraftQuotationSaveRequest(
        plan,
        typeof input.expectedVersion === 'number'
          ? input.expectedVersion
          : null,
      ),
    );
  } catch {
    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  if (saved.kind === 'REJECTED') {
    return saved;
  }

  return {
    kind: 'SAVED',
    quotationId: saved.quotationId,
    version: saved.version,
    plan,
  };
};
