import {
  buildAnyIrrPriceListQuery,
  buildCatalogItemByIdQuery,
  buildCreateCatalogItemMutation,
  buildCreatePriceListMutation,
  buildCreatePriceMutation,
  buildCreateQuotationLineMutation,
  buildCreateQuotationMutation,
  buildDefaultPriceListQuery,
  buildDeleteQuotationLineMutation,
  buildQuotationByIdQuery,
  buildQuotationLinesByQuotationQuery,
  buildUpdateCatalogItemMutation,
  buildUpdateQuotationMutation,
} from 'src/data/quotation-queries';
import { type GraphqlValue } from 'src/data/graphql-literal';
import { RecordApiError } from 'src/data/record-api';
import {
  canEditQuotationLines,
  type QuotationStatus,
} from 'src/domain/quotation/status';
import {
  buildCatalogItemWritePayload,
  buildDraftQuotationWritePayload,
  type SaveCatalogOutcome,
  type SaveDraftOutcome,
  validateCatalogItemUpsert,
  validateDraftQuotation,
} from 'src/services/quotation-save.service';
import {
  type CatalogItemUpsertInput,
} from 'src/domain/catalog/catalog-upsert';
import { type DraftQuotationInput } from 'src/domain/quotation/draft-quotation';

export type PersistDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
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
  dependencies: PersistDependencies,
): Promise<SaveDraftOutcome> => {
  const outcome = validateDraftQuotation(input);

  if (outcome.kind === 'REJECTED') {
    return outcome;
  }

  const payload = buildDraftQuotationWritePayload(outcome.plan);

  if (!payload.ok) {
    return {
      kind: 'REJECTED',
      code: payload.refusal.code,
      message: payload.refusal.detail,
    };
  }

  try {
    let quotationId = input.quotationId;

    if (quotationId) {
      const existing = await dependencies.execute(
        buildQuotationByIdQuery(quotationId),
      );
      const node = asRecord(existing.quotation);

      if (node === null || typeof node.status !== 'string') {
        return {
          kind: 'REJECTED',
          code: 'QUOTATION_NOT_FOUND',
          message: 'پیش‌فاکتور برای ویرایش پیدا نشد',
        };
      }

      const status = node.status as QuotationStatus;

      if (!canEditQuotationLines(status)) {
        return {
          kind: 'REJECTED',
          code: 'QUOTATION_IMMUTABLE',
          message:
            'پس از ارسال، ویرایش مستقیم مجاز نیست؛ باید نسخهٔ جدید ساخته شود',
        };
      }

      const currentVersion =
        typeof node.version === 'number' ? node.version : 1;

      const quotationData = omitNullish({
        name: payload.value.quotation.name,
        customerType: payload.value.quotation.customerType,
        personId: payload.value.quotation.personId,
        companyId: payload.value.quotation.companyId,
        currencyCode: payload.value.quotation.currencyCode,
        taxPolicy: payload.value.quotation.taxPolicy,
        paymentTerms: payload.value.quotation.paymentTerms,
        grossExact: payload.value.quotation.grossExact,
        lineDiscountExact: payload.value.quotation.lineDiscountExact,
        documentDiscountExact: payload.value.quotation.documentDiscountExact,
        documentDiscountKind: payload.value.quotation.documentDiscountKind,
        documentDiscountInputExact:
          payload.value.quotation.documentDiscountInputExact,
        netExact: payload.value.quotation.netExact,
        taxExact: payload.value.quotation.taxExact,
        totalExact: payload.value.quotation.totalExact,
        status: 'DRAFT',
        // Optimistic lock token: server compares this to the stored version.
        version: currentVersion,
      });

      await dependencies.execute(
        buildUpdateQuotationMutation(quotationId, quotationData),
      );

      const lineIds = readEdgesIds(
        await dependencies.execute(
          buildQuotationLinesByQuotationQuery(quotationId),
        ),
        'quotationLines',
      );

      for (const lineId of lineIds) {
        await dependencies.execute(buildDeleteQuotationLineMutation(lineId));
      }
    } else {
      const quotationData = omitNullish({
        ...payload.value.quotation,
        status: 'DRAFT',
      });
      const created = await dependencies.execute(
        buildCreateQuotationMutation(quotationData),
      );

      quotationId = readCreatedId(created, 'createQuotation');
    }

    if (!quotationId) {
      return {
        kind: 'REJECTED',
        code: 'PERSISTENCE_FAILED',
        message: 'ذخیره پیش‌فاکتور انجام نشد',
      };
    }

    for (const line of payload.value.lines) {
      await dependencies.execute(
        buildCreateQuotationLineMutation(
          omitNullish({
            ...line,
            quotationId,
          }),
        ),
      );
    }

    return { kind: 'SAVED', quotationId, plan: outcome.plan };
  } catch (error) {
    if (error instanceof RecordApiError && error.code === 'FORBIDDEN') {
      return {
        kind: 'REJECTED',
        code: 'PERMISSION_DENIED',
        message: 'دسترسی لازم برای ذخیره پیش‌فاکتور وجود ندارد',
      };
    }

    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }
};
