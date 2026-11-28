import {
  type AdapterCapabilities,
  decideOutboundAction,
} from 'src/domain/accounting/capabilities';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import {
  crmMicrosToAsanUnits,
} from 'src/domain/accounting/adapters/asan/asan-money-unit';
import {
  buildAccountingOperationId,
  canRetryOperation,
  isTerminalOperationState,
  type AccountingOperationKind,
  type AccountingSyncOperation,
} from 'src/domain/accounting/sync-operation';
import { hasRemoteVersionDrifted } from 'src/domain/catalog/item-link';
import {
  checkFinancialRequirements,
  financialSettingsFromRecord,
} from 'src/domain/accounting/financial-contract';
import { taxPolicyProfileFromSnapshot } from 'src/domain/accounting/tax-code-contract';
import { parseRevisionMicros, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

// The single gate between "the CRM intends to write" and "the CRM writes". Every refusal here
// is a first-class outcome with a stable code, so the operation record says WHY nothing was
// sent instead of leaving a row in PENDING forever.
export const QUOTATION_EXPORTABLE_STATUSES = new Set<string>([
  'READY_TO_SEND',
  'SENT',
  'CUSTOMER_ACCEPTED',
]);

export type OperationSnapshot = Pick<
  AccountingSyncOperation,
  'id' | 'kind' | 'state' | 'attempts' | 'internalRevision' | 'externalDocumentId'
>;

export type ItemPushInput = {
  connectionId: string;
  internalItemId: string;
  changedFields: string[];
  capabilities: AdapterCapabilities;
  link: {
    externalItemId: string | null;
    remoteVersion: string | null;
  } | null;
  // The version observed by a fresh read, when the caller took one. A value that differs
  // from the link means the vendor record moved since the last sync.
  observedRemoteVersion?: string | null;
  existingOperations: OperationSnapshot[];
  maxAttempts: number;
  reconciled: boolean;
};

export type ItemPushDecision =
  | {
      kind: 'CREATE';
      operationId: string;
      kindOfOperation: AccountingOperationKind;
      requiresReconciliationBeforeRetry: boolean;
    }
  | {
      kind: 'UPDATE_PRICES';
      operationId: string;
      kindOfOperation: AccountingOperationKind;
      requiresReconciliationBeforeRetry: boolean;
    }
  | { kind: 'ALREADY_SUCCEEDED'; operationId: string }
  | { kind: 'IN_PROGRESS'; operationId: string }
  | {
      kind: 'RETRY';
      operationId: string;
      requiresReconciliationBeforeRetry: boolean;
    }
  | {
      kind: 'CONFLICT';
      code: 'CONFLICT_REMOTE_CHANGED';
      detail: string;
      operationId: string | null;
    }
  | {
      kind: 'BLOCKED';
      code: string;
      detail: string;
      operationId: string | null;
    };

const findOperation = (
  operations: OperationSnapshot[],
  operationId: string,
): OperationSnapshot | null =>
  operations.find((operation) => operation.id === operationId) ?? null;

const classifyExistingOperation = ({
  operation,
  maxAttempts,
  reconciled,
  requiresReconciliation,
}: {
  operation: OperationSnapshot | null;
  maxAttempts: number;
  reconciled: boolean;
  requiresReconciliation: boolean;
}):
  | { kind: 'NEW' }
  | { kind: 'SUCCEEDED' }
  | { kind: 'IN_PROGRESS' }
  | { kind: 'RETRY'; requiresReconciliationBeforeRetry: boolean }
  | { kind: 'BLOCKED'; code: string; detail: string } => {
  if (operation === null) {
    return { kind: 'NEW' };
  }

  if (operation.state === 'SUCCEEDED') {
    return { kind: 'SUCCEEDED' };
  }

  if (operation.state === 'IN_FLIGHT') {
    return { kind: 'IN_PROGRESS' };
  }

  if (
    operation.state === 'FAILED_FINAL' ||
    operation.state === 'MANUAL_EXPORT_REQUIRED' ||
    operation.state === 'CANCELLED'
  ) {
    return {
      kind: 'BLOCKED',
      code:
        operation.state === 'MANUAL_EXPORT_REQUIRED'
          ? 'MANUAL_EXPORT_REQUIRED'
          : 'RETRY_NOT_ALLOWED',
      detail: `the previous attempt ended in ${operation.state}`,
    };
  }

  if (!canRetryOperation(operation, maxAttempts)) {
    return {
      kind: 'BLOCKED',
      code: 'RETRY_NOT_ALLOWED',
      detail: `retries stop at ${maxAttempts} attempts`,
    };
  }

  if (requiresReconciliation && !reconciled) {
    return {
      kind: 'BLOCKED',
      code: 'RECONCILIATION_REQUIRED',
      detail:
        'the previous attempt may have reached the vendor; confirm in the vendor before retrying',
    };
  }

  return { kind: 'RETRY', requiresReconciliationBeforeRetry: requiresReconciliation };
};

export const planItemPush = (input: ItemPushInput): ItemPushDecision => {
  const hasExternalLink =
    input.link !== null &&
    typeof input.link.externalItemId === 'string' &&
    input.link.externalItemId !== '';

  const intent = hasExternalLink ? 'ITEM_UPDATE' : 'ITEM_CREATE';
  const decision = decideOutboundAction({
    intent,
    capabilities: input.capabilities,
    hasExternalLink,
    changedFields: input.changedFields,
  });

  const operationKind: AccountingOperationKind =
    intent === 'ITEM_CREATE' ? 'CATALOG_ITEM_CREATE' : 'CATALOG_ITEM_UPDATE';

  const operationId = buildAccountingOperationId({
    connectionId: input.connectionId,
    kind: operationKind,
    internalEntityId: input.internalItemId,
    internalRevision: null,
  });

  if (hasExternalLink && input.observedRemoteVersion !== undefined) {
    const drifted = hasRemoteVersionDrifted({
      link: {
        internalItemId: input.internalItemId,
        connectionId: input.connectionId,
        externalItemId: input.link?.externalItemId ?? null,
        externalCode: null,
        remoteVersion: input.link?.remoteVersion ?? null,
        lastSyncedAt: null,
        syncStatus: 'LINKED',
      },
      observedRemoteVersion: input.observedRemoteVersion ?? null,
    });

    if (drifted) {
      return {
        kind: 'CONFLICT',
        code: 'CONFLICT_REMOTE_CHANGED',
        detail:
          'the vendor record changed after the last sync; re-read and reconcile before writing',
        operationId,
      };
    }
  }

  if (decision.kind === 'MANUAL_EXPORT_REQUIRED') {
    return {
      kind: 'BLOCKED',
      code: decision.reason,
      detail: decision.detail,
      operationId,
    };
  }

  if (decision.intent === 'NONE') {
    return {
      kind: 'BLOCKED',
      code: 'INVALID_INPUT',
      detail: 'nothing to send',
      operationId,
    };
  }

  const existing = classifyExistingOperation({
    operation: findOperation(input.existingOperations, operationId),
    maxAttempts: input.maxAttempts,
    reconciled: input.reconciled,
    requiresReconciliation: decision.requiresReconciliationBeforeRetry,
  });

  if (existing.kind === 'SUCCEEDED') {
    return { kind: 'ALREADY_SUCCEEDED', operationId };
  }

  if (existing.kind === 'IN_PROGRESS') {
    return { kind: 'IN_PROGRESS', operationId };
  }

  if (existing.kind === 'BLOCKED') {
    return {
      kind: 'BLOCKED',
      code: existing.code,
      detail: existing.detail,
      operationId,
    };
  }

  if (existing.kind === 'RETRY') {
    return {
      kind: 'RETRY',
      operationId,
      requiresReconciliationBeforeRetry: existing.requiresReconciliationBeforeRetry,
    };
  }

  return intent === 'ITEM_CREATE'
    ? {
        kind: 'CREATE',
        operationId,
        kindOfOperation: operationKind,
        requiresReconciliationBeforeRetry: decision.requiresReconciliationBeforeRetry,
      }
    : {
        kind: 'UPDATE_PRICES',
        operationId,
        kindOfOperation: operationKind,
        requiresReconciliationBeforeRetry: decision.requiresReconciliationBeforeRetry,
      };
};

export type QuotationExportLineLink = {
  lineId: string;
  externalItemId: string | null;
};

export type QuotationExportInput = {
  connectionId: string;
  quotation: {
    id: string;
    status: string;
    version: number;
    currencyCode: string;
  };
  revision: {
    version: number;
    snapshot: QuotationRevisionSnapshot;
  } | null;
  customerExternalId: string | null;
  lineLinks: QuotationExportLineLink[];
  capabilities: AdapterCapabilities;
  settings: ConnectionSettings;
  // Two separate switches on purpose: outbound writes and document registration are
  // different risk decisions, so enabling a price push must never enable a fiscal document.
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  existingOperations: OperationSnapshot[];
  maxAttempts: number;
  reconciled: boolean;
};

export type QuotationExportDecision =
  | {
      kind: 'READY';
      operationId: string;
      requiresReconciliationBeforeRetry: boolean;
      amountLines: { lineId: string; priceUnits: number }[];
    }
  | { kind: 'ALREADY_EXPORTED'; operationId: string; externalDocumentId: string | null }
  | { kind: 'IN_PROGRESS'; operationId: string }
  | {
      kind: 'RETRY';
      operationId: string;
      requiresReconciliationBeforeRetry: boolean;
    }
  | { kind: 'BLOCKED'; code: string; detail: string; operationId: string | null };

const block = (
  code: string,
  detail: string,
  operationId: string | null = null,
): QuotationExportDecision => ({ kind: 'BLOCKED', code, detail, operationId });

export const planQuotationExport = (
  input: QuotationExportInput,
): QuotationExportDecision => {
  const operationId = buildAccountingOperationId({
    connectionId: input.connectionId,
    kind: 'QUOTATION_REVISION_PUSH',
    internalEntityId: input.quotation.id,
    internalRevision: input.revision?.version ?? input.quotation.version,
  });

  const existing = findOperation(input.existingOperations, operationId);

  if (existing !== null) {
    if (existing.state === 'SUCCEEDED') {
      return {
        kind: 'ALREADY_EXPORTED',
        operationId,
        externalDocumentId: existing.externalDocumentId,
      };
    }

    if (existing.state === 'IN_FLIGHT') {
      return { kind: 'IN_PROGRESS', operationId };
    }

    if (isTerminalOperationState(existing.state)) {
      return block(
        existing.state === 'MANUAL_EXPORT_REQUIRED'
          ? 'MANUAL_EXPORT_REQUIRED'
          : 'RETRY_NOT_ALLOWED',
        `the previous attempt ended in ${existing.state}`,
        operationId,
      );
    }
  }

  if (!input.outboundEnabled) {
    return block('OUTBOUND_DISABLED', 'outbound accounting writes are off', operationId);
  }

  if (!input.documentExportEnabled) {
    return block(
      'DOCUMENT_EXPORT_DISABLED',
      'document registration needs its own explicit approval',
      operationId,
    );
  }

  if (!input.settings.transportApproved) {
    return block(
      'TRANSPORT_NOT_APPROVED',
      'the destination transport is not approved for writes',
      operationId,
    );
  }

  if (!QUOTATION_EXPORTABLE_STATUSES.has(input.quotation.status)) {
    return block(
      'QUOTATION_NOT_APPROVED',
      `a quotation in ${input.quotation.status} is not approved for accounting`,
      operationId,
    );
  }

  if (input.quotation.currencyCode !== 'IRR') {
    return block(
      'CURRENCY_NOT_IRR',
      'only rial quotations can be exported',
      operationId,
    );
  }

  if (input.revision === null) {
    return block(
      'REVISION_NOT_FOUND',
      'no issued revision exists for this quotation',
      operationId,
    );
  }

  if (input.settings.moneyUnit === 'UNCONFIRMED') {
    return block(
      'MONEY_UNIT_UNCONFIRMED',
      'the vendor unit must be confirmed before any amount is transferred',
      operationId,
    );
  }

  const snapshot = input.revision.snapshot;

  // WS3 C7: multi-policy revisions are refuse-closed until an adapter proves MULTI_TAX.
  // No current adapter capability documents multi-tax support, so distinct line policies block.
  const distinctLineTaxPolicies = new Set(
    snapshot.lines
      .map((line) => {
        const linePolicy =
          typeof line.taxPolicy === 'string' ? line.taxPolicy.trim() : '';

        return linePolicy !== ''
          ? linePolicy
          : (snapshot.taxPolicy ?? '').trim();
      })
      .filter((code) => code !== ''),
  );

  if (distinctLineTaxPolicies.size > 1) {
    return block(
      'MULTI_TAX_UNSUPPORTED',
      'این مقصد از چند سیاست مالیات روی یک سند پشتیبانی نمی‌کند',
      operationId,
    );
  }

  // One gate for the financial contract of this destination. It answers only what the
  // adapter declared: a single-currency destination is never asked for a currency code, a
  // rate/amount tax destination is never asked for a fiscal code, and a destination with no
  // tax contract refuses a taxed document instead of sending it without its tax.
  const documentTax = parseRevisionMicros(snapshot.totals.taxMicros);
  const documentDuty = parseRevisionMicros(snapshot.totals.dutyMicros ?? '0');
  const financialGate = checkFinancialRequirements({
    capabilities: input.capabilities,
    financial: financialSettingsFromRecord(input.settings.financial),
    taxPolicyMappings: input.settings.taxPolicyMappings,
    document: {
      taxPolicyCode: snapshot.taxPolicy ?? '',
      hasTax: documentTax.ok && documentTax.value > 0n,
      hasDuty: documentDuty.ok && documentDuty.value > 0n,
      currencyCode: input.quotation.currencyCode,
      // The rates this document was actually computed with, so a mapped code is checked
      // against the sealed rate and not against whatever the policy says today.
      taxPolicyRates: taxPolicyProfileFromSnapshot(snapshot),
    },
  });

  if (!financialGate.ok) {
    return block(
      financialGate.refusal.code,
      financialGate.refusal.detail,
      operationId,
    );
  }

  if (input.customerExternalId === null || input.customerExternalId.trim() === '') {
    return block(
      'CUSTOMER_NOT_LINKED',
      'the quotation customer has no vendor id',
      operationId,
    );
  }

  if (!input.capabilities.documents.createProforma) {
    return block(
      'CAPABILITY_MISSING',
      'this destination cannot register a pro-forma',
      operationId,
    );
  }

  if (snapshot.quotationId !== input.quotation.id) {
    return block(
      'REVISION_MISMATCH',
      'the stored revision belongs to another quotation',
      operationId,
    );
  }

  const linkByLineId = new Map(
    input.lineLinks.map((link) => [link.lineId, link.externalItemId]),
  );

  const amountLines: { lineId: string; priceUnits: number }[] = [];

  for (const line of snapshot.lines) {
    const externalItemId = linkByLineId.get(line.lineId) ?? null;

    if (externalItemId === null || externalItemId.trim() === '') {
      return block(
        'LINE_HAS_NO_PRODUCT_LINK',
        `line ${line.lineId} has no linked vendor product`,
        operationId,
      );
    }

    const total = parseRevisionMicros(line.totalMicros);
    const tax = parseRevisionMicros(line.taxMicros);

    if (!total.ok || !tax.ok) {
      return block('AMOUNT_NOT_A_DECIMAL', `line ${line.lineId} is not an exact amount`, operationId);
    }

    const net = total.value - tax.value;
    const priceUnits = crmMicrosToAsanUnits(net, input.settings.moneyUnit);

    if (!priceUnits.ok) {
      return block(priceUnits.refusal.code, priceUnits.refusal.detail, operationId);
    }

    amountLines.push({ lineId: line.lineId, priceUnits: priceUnits.value });
  }

  const discount = parseRevisionMicros(snapshot.totals.discountMicros);
  const tax = parseRevisionMicros(snapshot.totals.taxMicros);

  if (!discount.ok || !tax.ok) {
    return block('AMOUNT_NOT_A_DECIMAL', 'document totals are not exact amounts', operationId);
  }

  if (discount.value > 0n && !input.settings.specialCodes.discount) {
    return block(
      'SPECIAL_CODE_NOT_CONFIGURED',
      'the document carries a discount but the vendor discount special code is not configured',
      operationId,
    );
  }

  // A destination that models tax/discount as pre-existing item codes needs those codes
  // declared; one that carries tax as a field on a normal line does not. The financial gate
  // above already decided whether a code or a mapping is required at all.
  if (
    input.capabilities.requiresSpecialItemCodes &&
    tax.value > 0n &&
    !input.settings.specialCodes.tax
  ) {
    return block(
      'SPECIAL_CODE_NOT_CONFIGURED',
      'the document carries tax but the vendor tax special code is not configured',
      operationId,
    );
  }

  // Duty travels as its own pre-existing row on a destination that models components that
  // way. It is checked against its own flag so a destination that has the tax row but not
  // the duty row is refused rather than posting duty as tax. A destination that carries
  // duty inside the single policy code (or as an aggregate amount) has no duty row at all,
  // so asking for its code would invent a fiscal row the vendor never reads.
  const duty = parseRevisionMicros(snapshot.totals.dutyMicros ?? '0');

  if (
    input.capabilities.requiresSpecialItemCodes &&
    input.capabilities.dutyHandling !== 'AGGREGATE' &&
    input.capabilities.dutyHandling !== 'DUTY_WITHIN_POLICY' &&
    duty.ok &&
    duty.value > 0n &&
    !input.settings.specialCodes.duty
  ) {
    return block(
      'SPECIAL_CODE_NOT_CONFIGURED',
      'the document carries duty but the vendor duty special code is not configured',
      operationId,
    );
  }

  const requiresReconciliationBeforeRetry =
    !input.capabilities.documents.remoteIdempotency;

  if (existing !== null && existing.state === 'FAILED_RETRYABLE') {
    if (!canRetryOperation(existing, input.maxAttempts)) {
      return block('RETRY_NOT_ALLOWED', 'retry attempts are exhausted', operationId);
    }

    // A vendor with no idempotency may already have the document; a blind retry would
    // duplicate a fiscal record. The reconciliation flag is the human confirmation.
    if (requiresReconciliationBeforeRetry && !input.reconciled) {
      return block(
        'RECONCILIATION_REQUIRED',
        'check the vendor for a document from the previous attempt first',
        operationId,
      );
    }

    return {
      kind: 'RETRY',
      operationId,
      requiresReconciliationBeforeRetry,
    };
  }

  return {
    kind: 'READY',
    operationId,
    requiresReconciliationBeforeRetry,
    amountLines,
  };
};
