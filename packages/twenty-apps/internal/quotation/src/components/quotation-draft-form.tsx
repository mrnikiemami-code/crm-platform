import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext,
} from 'twenty-sdk/front-component';

import {
  CatalogItemCombobox,
  type CatalogComboboxSelection,
} from 'src/components/catalog-item-combobox';
import { MoneyAmountInput } from 'src/components/money-amount-input';
import { PersianPlainNumberInput } from 'src/components/persian-plain-number-input';
import {
  CustomerPicker,
  type CustomerSelection,
} from 'src/components/customer-picker';
import {
  QUOTATION_CURRENCIES_ROUTE,
  SAVE_DRAFT_ROUTE,
  SEARCH_CUSTOMERS_ROUTE,
  TAX_POLICIES_ROUTE,
  callAppRoute,
  callRoundingRulesNestAction,
} from 'src/components/quotation-api';
import {
  buildIrrPriceListsForPickerQuery,
} from 'src/data/quotation-queries';
import { executeRecordGraphql } from 'src/data/record-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  formatMoneyForDisplay,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  MULTI_CURRENCY_DOCUMENTS,
  OPERATIONAL_DOCUMENT_CURRENCY_CODE,
  selectInitialDocumentCurrencyCode,
} from 'src/domain/money/document-currency';
import { formatExactDecimalForPeople } from 'src/domain/money/display-format';
import { formatMicrosExact } from 'src/domain/money/micros';
import {
  findRoundingRuleByCode,
  parseStepRialsText,
  selectDefaultRoundingRule,
  type RoundingRuleCatalogEntry,
} from 'src/domain/money/rounding-rule';
import {
  DEFAULT_TAX_POLICY_ID,
  parseBasisPointsText,
  resolveTaxPolicy,
  selectInitialTaxPolicyCode,
  type TaxPolicyCatalogEntry,
  type TaxPolicyDefinition,
} from 'src/domain/money/tax-policy';
import {
  type DraftDiscountInput,
  type DraftLineInput,
} from 'src/domain/quotation/draft-quotation';
import { buildDraftQuotationPreview } from 'src/domain/quotation/draft-preview';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';
import {
  type EditableDraft,
  loadDraftForEdit,
} from 'src/services/quotation-draft-edit.service';

type DiscountKind = 'NONE' | 'RATE' | 'AMOUNT';

type LineDraft = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  unitRecordId: string | null;
  quantityText: string;
  unitPriceText: string;
  discountKind: DiscountKind;
  discountPercentText: string;
  discountAmountText: string;
  // WS3: independent per-line policy; new lines inherit the document default.
  taxPolicyCode: string;
  priceWarning: string | null;
  selectedPriceListId: string | null;
  selectedPriceId: string | null;
  selectedPriceValidFrom: string | null;
};

const newLine = (defaultTaxPolicyCode: string): LineDraft => ({
  clientLineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  catalogItemId: null,
  kind: 'PRODUCT',
  name: '',
  sku: null,
  description: null,
  unit: '',
  unitRecordId: null,
  quantityText: '۱',
  unitPriceText: '',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
  taxPolicyCode: defaultTaxPolicyCode,
  priceWarning: null,
  selectedPriceListId: null,
  selectedPriceId: null,
  selectedPriceValidFrom: null,
});

const PROBLEM_FALLBACK = 'لطفاً ورودی‌ها را بررسی کنید.';

// The draft is written by an app route, outside the browser's Apollo cache. The
// host owns that cache, so the only honest way to refresh the list behind the
// panel is to ask the host to refetch. Older hosts do not expose it; a missing
// bridge must not turn a successful save into an error.
type RefreshRecordDataHostFunction = () => Promise<void>;

const readRefreshRecordData = (): RefreshRecordDataHostFunction | null => {
  const api = (
    globalThis as unknown as {
      frontComponentHostCommunicationApi?: {
        refreshRecordData?: RefreshRecordDataHostFunction;
      };
    }
  ).frontComponentHostCommunicationApi;
  const refresh = api?.refreshRecordData;

  return typeof refresh === 'function' ? refresh : null;
};

const refreshRecordDataFromHost = async (): Promise<void> => {
  const refresh = readRefreshRecordData();

  if (refresh === null) {
    return;
  }

  try {
    await refresh();
  } catch {
    // The save already succeeded; a stale table row is not worth a second alert.
  }
};

const LEGACY_TAX_LABEL = (() => {
  const policy = resolveTaxPolicy(DEFAULT_TAX_POLICY_ID);

  return policy.ok ? policy.value.label : 'مالیات';
})();

// The workspace catalog, as the settings route describes it. `rateBasisPoints`
// arrives as text because an integer percentage must not go through a float
// scalar; a row whose rate cannot be parsed is skipped rather than guessed.
type DocumentCurrencyOption = {
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};

const readDocumentCurrencies = (
  data: Record<string, unknown>,
): DocumentCurrencyOption[] => {
  const currencies = Array.isArray(data.currencies) ? data.currencies : [];

  return currencies.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const code =
      typeof row.code === 'string' ? row.code.trim().toUpperCase() : '';

    if (code === '') {
      return [];
    }

    return [
      {
        code,
        name:
          typeof row.name === 'string' && row.name.trim() !== ''
            ? row.name.trim()
            : code,
        isDefault: row.isDefault === true,
        isActive: row.isActive !== false,
      },
    ];
  });
};

const readTaxPolicies = (
  data: Record<string, unknown>,
): TaxPolicyCatalogEntry[] => {
  const policies = Array.isArray(data.policies) ? data.policies : [];

  return policies.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const code = typeof row.code === 'string' ? row.code.trim() : '';
    const rate = parseBasisPointsText(
      typeof row.rateBasisPoints === 'string' ? row.rateBasisPoints : '',
    );
    const dutyRate = parseBasisPointsText(
      typeof row.dutyRateBasisPoints === 'string'
        ? row.dutyRateBasisPoints
        : '0',
    );

    if (code === '' || !rate.ok || !dutyRate.ok) {
      return [];
    }

    return [
      {
        recordId: typeof row.recordId === 'string' ? row.recordId : '',
        id: code,
        label:
          typeof row.name === 'string' && row.name.trim() !== ''
            ? row.name.trim()
            : code,
        rateBasisPoints: rate.value,
        dutyRateBasisPoints: dutyRate.value,
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        isExempt: row.isExempt === true,
        position: index,
      },
    ];
  });
};

// A draft carries the rates it was priced at. Reopening it keeps those rates until the
// operator chooses another policy; a legacy draft with no stored rate stays unpinned and
// is never assigned a guessed one.
const readStoredTaxRate = (
  code: string | null,
  rateBasisPoints: string | null,
  dutyRateBasisPoints: string | null,
): {
  code: string;
  rateBasisPoints: bigint;
  dutyRateBasisPoints: bigint;
} | null => {
  const normalizedCode = (code ?? '').trim();

  if (normalizedCode === '' || rateBasisPoints === null) {
    return null;
  }

  const rate = parseBasisPointsText(rateBasisPoints);
  // Absent duty on a reopened draft means it was priced before duty existed, so it
  // keeps zero duty instead of adopting today's duty rate.
  const dutyRate = parseBasisPointsText(dutyRateBasisPoints ?? '0');

  return rate.ok && dutyRate.ok
    ? {
        code: normalizedCode,
        rateBasisPoints: rate.value,
        dutyRateBasisPoints: dutyRate.value,
      }
    : null;
};

const legacyTaxPolicyEntry = (): TaxPolicyCatalogEntry => {
  const legacy = resolveTaxPolicy(DEFAULT_TAX_POLICY_ID);

  return {
    recordId: '',
    id: DEFAULT_TAX_POLICY_ID,
    label: legacy.ok ? legacy.value.label : LEGACY_TAX_LABEL,
    rateBasisPoints: legacy.ok ? legacy.value.rateBasisPoints : 900n,
    dutyRateBasisPoints: legacy.ok ? legacy.value.dutyRateBasisPoints : 0n,
    isActive: true,
    isDefault: true,
    isExempt: false,
    position: 0,
  };
};

const readRoundingRules = (
  data: Record<string, unknown>,
): RoundingRuleCatalogEntry[] => {
  const rules = Array.isArray(data.rules) ? data.rules : [];

  return rules.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const code = typeof row.code === 'string' ? row.code.trim() : '';
    const step = parseStepRialsText(
      typeof row.stepRials === 'string' ? row.stepRials : '',
    );

    if (code === '' || !step.ok) {
      return [];
    }

    return [
      {
        recordId: typeof row.recordId === 'string' ? row.recordId : '',
        id: code,
        label:
          typeof row.name === 'string' && row.name.trim() !== ''
            ? row.name.trim()
            : code,
        stepRials: step.value,
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        position: index,
      },
    ];
  });
};

// The host already sends `objectNameSingular`, but the SDK release this app is
// pinned to does not declare it yet; the field is read through a narrow cast so
// the record identity is not lost until the SDK type catches up.
type ExecutionContextWithObjectName = {
  objectNameSingular?: string | null;
};

const selectObjectNameSingular = (
  context: Record<string, unknown> | null | undefined,
): string =>
  (context as ExecutionContextWithObjectName | null | undefined)
    ?.objectNameSingular ?? '';

const selectSelectedRecordIds = (
  context: Record<string, unknown> | null | undefined,
): string[] => {
  const ids = (context as { selectedRecordIds?: string[] | null } | null)
    ?.selectedRecordIds;

  return Array.isArray(ids) ? ids : [];
};

const toDiscountInput = (
  kind: DiscountKind,
  percentText: string,
  amountText: string,
): DraftDiscountInput => {
  if (kind === 'RATE') {
    return percentText.trim() === ''
      ? { kind: 'NONE' }
      : { kind: 'RATE', percentText };
  }

  if (kind === 'AMOUNT') {
    return amountText.trim() === ''
      ? { kind: 'NONE' }
      : { kind: 'AMOUNT', text: amountText };
  }

  return { kind: 'NONE' };
};

const toDraftLineInput = (
  line: LineDraft,
  moneyUnit: MoneyUnit,
  lineTaxPolicyDefinition: TaxPolicyDefinition | null | undefined,
): DraftLineInput => ({
  clientLineId: line.clientLineId,
  catalogItemId: line.catalogItemId,
  kind: line.kind,
  name: line.name,
  description: line.description,
  unit: line.unit,
  unitRecordId: line.unitRecordId ?? null,
  quantityText: line.quantityText,
  unitPriceText: line.unitPriceText,
  moneyUnit,
  discount: toDiscountInput(
    line.discountKind,
    line.discountPercentText,
    line.discountAmountText,
  ),
  taxPolicy: line.taxPolicyCode,
  taxPolicyDefinition: lineTaxPolicyDefinition,
  selectedPriceListId: line.selectedPriceListId,
  selectedPriceId: line.selectedPriceId,
  selectedPriceValidFrom: line.selectedPriceValidFrom,
});

const lineCardStyle = (index: number): CSSProperties => ({
  ...styles.lineCard,
  background: index % 2 === 0 ? '#f7f8fa' : '#eef3fb',
});

const formatPlanAmount = (micros: bigint, unit: MoneyUnit): string => {
  const display = formatMoneyForDisplay({
    irrMicros: micros,
    unit,
    formatExact: formatMicrosExact,
    formatPeople: formatExactDecimalForPeople,
  });

  return display.ok ? display.value : '—';
};

const customerTypeLabel = (type: 'PERSON' | 'COMPANY'): string =>
  type === 'PERSON' ? 'حقیقی' : 'حقوقی';

const RESPONSIVE_FORM_CSS = `
.qd-form { box-sizing: border-box; }
.qd-form *, .qd-form *::before, .qd-form *::after { box-sizing: border-box; }
.qd-form .qd-row { display: flex; gap: 8px; min-width: 0; flex-wrap: wrap; }
.qd-form .qd-field { flex: 1 1 140px; min-width: 0; }
.qd-form .qd-line-totals { margin-top: 4px; }
.qd-form .qd-actions button { min-height: 40px; }
@media (max-width: 430px) {
  .qd-form .qd-row { flex-direction: column; }
  .qd-form .qd-field { flex: 1 1 auto; width: 100%; }
  .qd-form .qd-actions { flex-direction: column-reverse; align-items: stretch; }
  .qd-form .qd-actions button { width: 100%; }
  .qd-form .qd-line-card { padding: 10px; }
}
`;

export const QuotationDraftForm = () => {
  const sourceObject = useFrontComponentExecutionContext(
    selectObjectNameSingular,
  );
  const selectedRecordIds = useFrontComponentExecutionContext(
    selectSelectedRecordIds,
  );
  const sourceRecordId = selectedRecordIds[0] ?? '';
  const isRecordEdit = sourceObject === 'quotation' && sourceRecordId !== '';

  const initialCustomerType =
    sourceObject === 'person'
      ? ('PERSON' as const)
      : sourceObject === 'company'
        ? ('COMPANY' as const)
        : ('COMPANY' as const);

  const [name, setName] = useState('پیش‌فاکتور جدید');
  const [paymentTerms, setPaymentTerms] = useState('۳۰ روز');
  const [expiresAt, setExpiresAt] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [documentNotes, setDocumentNotes] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [issuerLegalName, setIssuerLegalName] = useState('');
  const [issuerNationalId, setIssuerNationalId] = useState('');
  const [issuerEconomicCode, setIssuerEconomicCode] = useState('');
  const [issuerAddress, setIssuerAddress] = useState('');
  const [issuerPhone, setIssuerPhone] = useState('');
  const [priceListOptions, setPriceListOptions] = useState<
    Array<{ id: string; name: string; isDefault: boolean }>
  >([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(
    null,
  );
  const [selectedPriceListName, setSelectedPriceListName] = useState<
    string | null
  >(null);
  const [moneyUnit, setMoneyUnit] = useState<MoneyUnit>('TOMAN');
  const [customerType, setCustomerType] = useState<'PERSON' | 'COMPANY'>(
    initialCustomerType,
  );
  const [customerIds, setCustomerIds] = useState<{
    personId: string | null;
    companyId: string | null;
  }>(() =>
    sourceObject === 'person' && sourceRecordId !== ''
      ? { personId: sourceRecordId, companyId: null }
      : sourceObject === 'company' && sourceRecordId !== ''
        ? { personId: null, companyId: sourceRecordId }
        : { personId: null, companyId: null },
  );
  // Labels are never derived from an id: a preselected relation is resolved by
  // reading the record, so the operator sees a name they can trust.
  const [customerLabels, setCustomerLabels] = useState<{
    PERSON: string | null;
    COMPANY: string | null;
  }>({ PERSON: null, COMPANY: null });
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(
    null,
  );
  const [recordVersion, setRecordVersion] = useState<number | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(isRecordEdit);
  const [draftLocked, setDraftLocked] = useState(false);
  const [documentDiscountKind, setDocumentDiscountKind] =
    useState<DiscountKind>('NONE');
  const [documentDiscountPercentText, setDocumentDiscountPercentText] =
    useState('');
  const [documentDiscountAmountText, setDocumentDiscountAmountText] =
    useState('');
  const [taxPolicies, setTaxPolicies] = useState<TaxPolicyCatalogEntry[]>([]);
  const [taxPolicyCode, setTaxPolicyCode] = useState(DEFAULT_TAX_POLICY_ID);
  const [roundingRules, setRoundingRules] = useState<
    RoundingRuleCatalogEntry[]
  >([]);
  const [roundingRuleCode, setRoundingRuleCode] = useState<string | null>(null);
  const [storedRoundingRule, setStoredRoundingRule] = useState<{
    code: string;
    name: string;
    stepRials: bigint;
    recordId: string | null;
  } | null>(null);
  const roundingRuleChosenByOperator = useRef(false);
  const [documentCurrencies, setDocumentCurrencies] = useState<
    DocumentCurrencyOption[]
  >([]);
  const [documentCurrencyCode, setDocumentCurrencyCode] = useState<string>(
    OPERATIONAL_DOCUMENT_CURRENCY_CODE,
  );
  const documentCurrencyChosenByOperator = useRef(false);
  const [lines, setLines] = useState<LineDraft[]>(() => [
    newLine(DEFAULT_TAX_POLICY_ID),
  ]);
  // The rate a reopened draft was saved with. It wins over the catalog until the
  // operator picks a different policy, so a later settings edit cannot silently
  // reprice a document that already exists.
  const [storedTaxRate, setStoredTaxRate] = useState<{
    code: string;
    rateBasisPoints: bigint;
    dutyRateBasisPoints: bigint;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addHovered, setAddHovered] = useState(false);
  // A NEW draft starts from the workspace default, but an operator's own choice in the
  // select always wins: the catalog can arrive after they already picked a policy.
  const taxPolicyChosenByOperator = useRef(false);

  // The rate is workspace data, so the form reads it instead of embedding one. A
  // failure here leaves the legacy 9% baseline in place; it must not block a save
  // that the settings page may not have been opened for yet.
  useEffect(() => {
    let cancelled = false;

    const loadTaxPolicies = async () => {
      try {
        const response = await callAppRoute(TAX_POLICIES_ROUTE, {
          action: 'list',
        });

        if (cancelled || response.data.success !== true) {
          return;
        }

        const rows = readTaxPolicies(response.data);

        if (rows.length === 0) {
          return;
        }

        setTaxPolicies(rows);

        // An existing draft keeps the policy it was saved with (hydrated below); a new
        // draft must take the flagged default. Matching "the current code still exists"
        // was wrong: the legacy 9% row usually exists, so the default was never applied.
        setTaxPolicyCode((current) => {
          const next = selectInitialTaxPolicyCode({
            entries: rows,
            currentCode: current,
            keepCurrent: isRecordEdit || taxPolicyChosenByOperator.current,
          });

          // New drafts: push the workspace default onto lines that still hold the
          // bootstrap code so the first card matches the document default select.
          if (
            !isRecordEdit &&
            !taxPolicyChosenByOperator.current &&
            next !== current
          ) {
            setLines((existing) =>
              existing.map((line) =>
                line.taxPolicyCode === current
                  ? { ...line, taxPolicyCode: next }
                  : line,
              ),
            );
          }

          return next;
        });
      } catch (loadFailure) {
        // The save route validates the policy on the server; this panel only
        // needs a rate to preview with.
        console.error(
          'quotation-draft-form: tax policy load failed',
          loadFailure,
        );
      }
    };

    const loadRoundingRules = async () => {
      try {
        // Nest boundary — Dev /s GraphQL path is unreliable across worker images.
        const response = await callRoundingRulesNestAction({
          action: 'list',
        });

        if (cancelled || response.data.success !== true) {
          return;
        }

        let rows = readRoundingRules(response.data);

        if (rows.length === 0) {
          const bootstrapped = await callRoundingRulesNestAction({
            action: 'bootstrap',
          });

          if (cancelled || bootstrapped.data.success !== true) {
            return;
          }

          rows = readRoundingRules(bootstrapped.data);
        }

        if (rows.length === 0) {
          return;
        }

        setRoundingRules(rows);

        if (!isRecordEdit && !roundingRuleChosenByOperator.current) {
          const defaultRule = selectDefaultRoundingRule(rows);

          if (defaultRule !== null) {
            setRoundingRuleCode(defaultRule.id);
          }
        }
      } catch (loadFailure) {
        console.error(
          'quotation-draft-form: rounding rule load failed',
          loadFailure,
        );
      }
    };

    void loadTaxPolicies();
    void loadRoundingRules();

    return () => {
      cancelled = true;
    };
  }, [isRecordEdit]);

  // WS4: document currency from workspace catalog (phase-1 operational IRR only).
  useEffect(() => {
    let cancelled = false;

    const loadCurrencies = async () => {
      try {
        let response = await callAppRoute(QUOTATION_CURRENCIES_ROUTE, {
          action: 'list',
        });

        if (cancelled) {
          return;
        }

        let rows =
          response.data.success === true
            ? readDocumentCurrencies(response.data)
            : [];

        if (rows.length === 0) {
          response = await callAppRoute(QUOTATION_CURRENCIES_ROUTE, {
            action: 'bootstrap',
          });

          if (cancelled || response.data.success !== true) {
            return;
          }

          rows = readDocumentCurrencies(response.data);
        }

        if (rows.length === 0) {
          return;
        }

        setDocumentCurrencies(rows);
        setDocumentCurrencyCode((current) =>
          selectInitialDocumentCurrencyCode({
            entries: rows,
            currentCode: current,
            keepCurrent:
              isRecordEdit || documentCurrencyChosenByOperator.current,
          }),
        );
      } catch (loadFailure) {
        console.error(
          'quotation-draft-form: currency catalog load failed',
          loadFailure,
        );
      }
    };

    void loadCurrencies();

    return () => {
      cancelled = true;
    };
  }, [isRecordEdit]);

  useEffect(() => {
    let cancelled = false;

    const loadPriceLists = async () => {
      try {
        const data = await executeRecordGraphql(buildIrrPriceListsForPickerQuery());
        const connection = data.priceLists as
          | { edges?: Array<{ node?: Record<string, unknown> }> }
          | undefined;
        const edges = Array.isArray(connection?.edges) ? connection.edges : [];

        const rows = edges.flatMap((edge) => {
          const node = edge?.node;
          const id = typeof node?.id === 'string' ? node.id.trim() : '';
          const name =
            typeof node?.name === 'string' && node.name.trim() !== ''
              ? node.name.trim()
              : id;

          if (id === '') {
            return [];
          }

          return [
            {
              id,
              name,
              isDefault: node?.isDefault === true,
            },
          ];
        });

        if (cancelled || rows.length === 0) {
          return;
        }

        setPriceListOptions(rows);

        if (selectedPriceListId === null) {
          const preferred =
            rows.find((row) => row.isDefault) ?? rows[0] ?? null;

          if (preferred !== null) {
            setSelectedPriceListId(preferred.id);
            setSelectedPriceListName(preferred.name);
          }
        }
      } catch (loadFailure) {
        console.error(
          'quotation-draft-form: price list load failed',
          loadFailure,
        );
      }
    };

    void loadPriceLists();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- default list once on mount
  }, []);

  useEffect(() => {
    if (!isRecordEdit) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      setLoadingDraft(true);
      setError(null);

      try {
        const result = await loadDraftForEdit(sourceRecordId, {
          execute: executeRecordGraphql,
        });

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setError(
            toPersianUiMessage(
              result.refusal.detail,
              'بارگذاری پیش‌فاکتور ممکن نشد؛ صفحه را دوباره باز کنید.',
            ),
          );
          return;
        }

        const draft: EditableDraft = result.value;

        setEditingQuotationId(draft.quotationId);
        setRecordVersion(draft.version);
        setName(draft.name);
        setPaymentTerms(draft.paymentTerms);
        setExpiresAt(draft.expiresAt ?? '');
        setPaymentDueDate(draft.paymentDueDate ?? '');
        setDeliveryTerms(draft.deliveryTerms ?? '');
        setDocumentNotes(draft.documentNotes ?? '');
        setVisitorName(draft.visitorName ?? '');
        setIssuerLegalName(draft.issuerLegalName ?? '');
        setIssuerNationalId(draft.issuerNationalId ?? '');
        setIssuerEconomicCode(draft.issuerEconomicCode ?? '');
        setIssuerAddress(draft.issuerAddress ?? '');
        setIssuerPhone(draft.issuerPhone ?? '');
        setSelectedPriceListId(draft.selectedPriceListId);
        setSelectedPriceListName(draft.selectedPriceListName);
        setMoneyUnit(draft.moneyUnit);
        setDocumentCurrencyCode(
          draft.currencyCode !== null && draft.currencyCode.trim() !== ''
            ? draft.currencyCode.trim().toUpperCase()
            : OPERATIONAL_DOCUMENT_CURRENCY_CODE,
        );
        setCustomerType(draft.customerType);
        setCustomerIds({
          personId: draft.personId,
          companyId: draft.companyId,
        });
        setCustomerLabels({
          PERSON: draft.customerType === 'PERSON' ? draft.customerLabel : null,
          COMPANY:
            draft.customerType === 'COMPANY' ? draft.customerLabel : null,
        });
        setDocumentDiscountKind(draft.documentDiscountKind);
        setDocumentDiscountPercentText(draft.documentDiscountPercentText);
        setDocumentDiscountAmountText(draft.documentDiscountAmountText);
        setTaxPolicyCode(
          draft.taxPolicy !== null && draft.taxPolicy.trim() !== ''
            ? draft.taxPolicy.trim()
            : DEFAULT_TAX_POLICY_ID,
        );
        setStoredTaxRate(
          readStoredTaxRate(
            draft.taxPolicy,
            draft.taxRateBasisPoints,
            draft.dutyRateBasisPoints,
          ),
        );
        const storedStep = parseStepRialsText(
          draft.roundingStepRials ?? '',
        );
        if (
          draft.roundingRuleCode !== null &&
          draft.roundingRuleCode.trim() !== '' &&
          storedStep.ok
        ) {
          setRoundingRuleCode(draft.roundingRuleCode.trim());
          setStoredRoundingRule({
            code: draft.roundingRuleCode.trim(),
            name:
              draft.roundingRuleName !== null &&
              draft.roundingRuleName.trim() !== ''
                ? draft.roundingRuleName.trim()
                : draft.roundingRuleCode.trim(),
            stepRials: storedStep.value,
            recordId: draft.roundingRuleRecordId,
          });
          roundingRuleChosenByOperator.current = true;
        } else {
          // Legacy drafts without a snapshot keep whole-rial floor until the
          // operator explicitly picks a named rule.
          setRoundingRuleCode('STEP_1');
          setStoredRoundingRule({
            code: 'STEP_1',
            name: 'ریال صحیح',
            stepRials: 1n,
            recordId: null,
          });
        }
        const headerTaxPolicy =
          draft.taxPolicy !== null && draft.taxPolicy.trim() !== ''
            ? draft.taxPolicy.trim()
            : DEFAULT_TAX_POLICY_ID;

        setLines(
          draft.lines.map((line) => ({
            clientLineId: line.clientLineId,
            catalogItemId: line.catalogItemId,
            kind: line.kind,
            name: line.name,
            sku: null,
            description: line.description,
            unit: line.unit,
          unitRecordId: line.unitRecordId ?? null,
            quantityText: line.quantityText,
            unitPriceText: line.unitPriceText,
            discountKind: line.discountKind,
            discountPercentText: line.discountPercentText,
            discountAmountText: line.discountAmountText,
            // Legacy header-only drafts: copy document policy onto each line once.
            taxPolicyCode:
              line.taxPolicy !== null && line.taxPolicy.trim() !== ''
                ? line.taxPolicy.trim()
                : headerTaxPolicy,
            priceWarning: null,
            selectedPriceListId: line.selectedPriceListId,
            selectedPriceId: line.selectedPriceId,
            selectedPriceValidFrom: line.selectedPriceValidFrom,
          })),
        );

        if (!draft.contentEditable) {
          // The real lock lives on the server; this only stops the form from
          // offering a save that would be refused anyway.
          setDraftLocked(true);
        }
      } catch (loadFailure) {
        // A transport or GraphQL failure is not something an operator can act on.
        // The technical detail belongs in the console, the panel gets Persian.
        console.error('quotation-draft-form: draft load failed', loadFailure);

        if (!cancelled) {
          setError('بارگذاری پیش‌فاکتور ممکن نشد؛ صفحه را دوباره باز کنید.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [isRecordEdit, sourceRecordId]);

  // A preselected customer (create from a person/company) arrives as an id only.
  // The label is read back from the record so the panel never shows a raw id.
  useEffect(() => {
    if (isRecordEdit) {
      return;
    }

    const pending: { type: 'PERSON' | 'COMPANY'; id: string }[] = [];

    if (customerIds.personId !== null && customerLabels.PERSON === null) {
      pending.push({ type: 'PERSON', id: customerIds.personId });
    }

    if (customerIds.companyId !== null && customerLabels.COMPANY === null) {
      pending.push({ type: 'COMPANY', id: customerIds.companyId });
    }

    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    const resolveLabels = async () => {
      for (const entry of pending) {
        try {
          const response = await callAppRoute(SEARCH_CUSTOMERS_ROUTE, {
            customerType: entry.type,
            search: '',
            recordId: entry.id,
          });

          if (cancelled) {
            return;
          }

          const rows = Array.isArray(response.data.rows)
            ? response.data.rows
            : [];
          const row = rows.find(
            (candidate) =>
              typeof candidate === 'object' &&
              candidate !== null &&
              (candidate as { id?: unknown }).id === entry.id,
          ) as { label?: unknown } | undefined;

          if (typeof row?.label === 'string' && row.label.trim() !== '') {
            setCustomerLabels((current) => ({
              ...current,
              [entry.type]: row.label as string,
            }));
          }
        } catch {
          // The save validates the id on the server; a missing label is cosmetic.
        }
      }
    };

    void resolveLabels();

    return () => {
      cancelled = true;
    };
  }, [
    isRecordEdit,
    customerIds.personId,
    customerIds.companyId,
    customerLabels.PERSON,
    customerLabels.COMPANY,
  ]);

  const taxPolicyOptions = useMemo(() => {
    const active = taxPolicies.filter((policy) => policy.isActive);
    const selected = taxPolicies.find(
      (policy) => policy.id === taxPolicyCode,
    );

    if (selected !== undefined && !selected.isActive) {
      // Reopening a draft whose policy was later deactivated must still show the
      // rate it was saved with; the save route refuses to re-apply it.
      return [selected, ...active.filter((policy) => policy.id !== selected.id)];
    }

    return active.length > 0 ? active : [legacyTaxPolicyEntry()];
  }, [taxPolicies, taxPolicyCode]);

  const selectedTaxPolicy = useMemo(() => {
    const fromCatalog =
      taxPolicies.find((policy) => policy.id === taxPolicyCode) ??
      (taxPolicyCode === DEFAULT_TAX_POLICY_ID
        ? legacyTaxPolicyEntry()
        : null);

    if (fromCatalog === null) {
      return null;
    }

    // The stored rates belong to the policy they were saved with; adopting a new
    // policy means adopting that policy's rates.
    if (storedTaxRate !== null && storedTaxRate.code === taxPolicyCode) {
      return {
        ...fromCatalog,
        rateBasisPoints: storedTaxRate.rateBasisPoints,
        dutyRateBasisPoints: storedTaxRate.dutyRateBasisPoints,
      };
    }

    return fromCatalog;
  }, [taxPolicies, taxPolicyCode, storedTaxRate]);

  const taxPolicyDefinition = useMemo(
    () =>
      selectedTaxPolicy === null
        ? null
        : {
            id: selectedTaxPolicy.id,
            label: selectedTaxPolicy.label,
            rateBasisPoints: selectedTaxPolicy.rateBasisPoints,
            dutyRateBasisPoints: selectedTaxPolicy.dutyRateBasisPoints,
            isExempt: selectedTaxPolicy.isExempt,
          },
    [selectedTaxPolicy],
  );

  const resolveLineTaxDefinition = (
    lineTaxPolicyCode: string,
  ): TaxPolicyDefinition | null => {
    if (
      taxPolicyDefinition !== null &&
      lineTaxPolicyCode === taxPolicyDefinition.id
    ) {
      return taxPolicyDefinition;
    }

    const fromCatalog = taxPolicies.find(
      (policy) => policy.id === lineTaxPolicyCode,
    );

    if (fromCatalog !== undefined) {
      return {
        id: fromCatalog.id,
        label: fromCatalog.label,
        rateBasisPoints: fromCatalog.rateBasisPoints,
        dutyRateBasisPoints: fromCatalog.dutyRateBasisPoints,
        isExempt: fromCatalog.isExempt,
      };
    }

    if (lineTaxPolicyCode === DEFAULT_TAX_POLICY_ID) {
      const legacy = resolveTaxPolicy(DEFAULT_TAX_POLICY_ID);

      return legacy.ok ? legacy.value : null;
    }

    return null;
  };

  const preview = useMemo(() => {
    const draftLines = lines.map((line) =>
      toDraftLineInput(
        line,
        moneyUnit,
        resolveLineTaxDefinition(line.taxPolicyCode),
      ),
    );

    const selectedRounding =
      findRoundingRuleByCode(roundingRules, roundingRuleCode) ??
      (storedRoundingRule !== null &&
      storedRoundingRule.code === roundingRuleCode
        ? {
            recordId: storedRoundingRule.recordId ?? '',
            id: storedRoundingRule.code,
            label: storedRoundingRule.name,
            stepRials: storedRoundingRule.stepRials,
            isActive: true,
            isDefault: false,
            position: 0,
          }
        : null);

    return buildDraftQuotationPreview({
      quotationId: editingQuotationId,
      status: 'DRAFT',
      customerType,
      personId: customerType === 'PERSON' ? customerIds.personId : null,
      companyId: customerType === 'COMPANY' ? customerIds.companyId : null,
      name,
      paymentTerms,
      taxPolicy: taxPolicyCode,
      taxPolicyDefinition,
      currencyCode: documentCurrencyCode,
      documentDiscount: toDiscountInput(
        documentDiscountKind,
        documentDiscountPercentText,
        documentDiscountAmountText,
      ),
      displayMoneyUnit: moneyUnit,
      roundingRuleCode: selectedRounding?.id ?? roundingRuleCode,
      roundingRuleName: selectedRounding?.label ?? null,
      roundingStepRials: selectedRounding?.stepRials ?? 1n,
      roundingRuleRecordId: selectedRounding?.recordId || null,
      expiresAt: expiresAt.trim() || null,
      paymentDueDate: paymentDueDate.trim() || null,
      deliveryTerms: deliveryTerms.trim() || null,
      documentNotes: documentNotes.trim() || null,
      issuerLegalName: issuerLegalName.trim() || null,
      issuerNationalId: issuerNationalId.trim() || null,
      issuerEconomicCode: issuerEconomicCode.trim() || null,
      issuerAddress: issuerAddress.trim() || null,
      issuerPhone: issuerPhone.trim() || null,
      visitorName: visitorName.trim() || null,
      selectedPriceListId,
      selectedPriceListName,
      lines: draftLines,
    });
  }, [
    lines,
    moneyUnit,
    customerType,
    customerIds,
    editingQuotationId,
    name,
    paymentTerms,
    taxPolicyCode,
    taxPolicyDefinition,
    taxPolicies,
    documentCurrencyCode,
    documentDiscountKind,
    documentDiscountPercentText,
    documentDiscountAmountText,
    roundingRules,
    roundingRuleCode,
    storedRoundingRule,
    expiresAt,
    paymentDueDate,
    deliveryTerms,
    documentNotes,
    visitorName,
    issuerLegalName,
    issuerNationalId,
    issuerEconomicCode,
    issuerAddress,
    issuerPhone,
    selectedPriceListId,
    selectedPriceListName,
  ]);

  const summaryPlan =
    preview.partialPlan && preview.partialPlan.ok
      ? preview.partialPlan.value
      : null;
  const summaryRefusal =
    preview.partialPlan && !preview.partialPlan.ok
      ? preview.partialPlan.refusal.detail
      : null;

  const updateLine = (clientLineId: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) =>
        line.clientLineId === clientLineId ? { ...line, ...patch } : line,
      ),
    );
  };

  const selectedCustomer: CustomerSelection | null =
    customerType === 'PERSON'
      ? customerIds.personId === null
        ? null
        : {
            id: customerIds.personId,
            label: customerLabels.PERSON ?? 'در حال خواندن نام مشتری…',
          }
      : customerIds.companyId === null
        ? null
        : {
            id: customerIds.companyId,
            label: customerLabels.COMPANY ?? 'در حال خواندن نام مشتری…',
          };

  const onCustomerTypeChange = (nextType: 'PERSON' | 'COMPANY') => {
    if (nextType === customerType) {
      return;
    }

    // Drop the previous side so a PERSON id cannot ride along with COMPANY.
    setCustomerType(nextType);
    setCustomerIds({ personId: null, companyId: null });
    setCustomerLabels({ PERSON: null, COMPANY: null });
  };

  // Selecting a record is the only way a customer is set. The other side is
  // cleared so a stale relation can never be sent alongside the new one.
  const onSelectCustomer = (selection: CustomerSelection) => {
    setCustomerIds(
      customerType === 'PERSON'
        ? { personId: selection.id, companyId: null }
        : { personId: null, companyId: selection.id },
    );
    setCustomerLabels((current) => ({
      ...current,
      [customerType]: selection.label,
    }));
  };

  const applyCatalogSelection = (
    clientLineId: string,
    selection: CatalogComboboxSelection,
  ) => {
    updateLine(clientLineId, {
      catalogItemId: selection.catalogItemId,
      kind: selection.kind,
      name: selection.name,
      sku: selection.sku,
      description: selection.description,
      unit: selection.unit,
      unitRecordId: selection.unitRecordId ?? null,
      unitPriceText: selection.unitPriceText,
      selectedPriceListId,
      selectedPriceId: selection.selectedPriceId,
      selectedPriceValidFrom: selection.selectedPriceValidFrom,
      priceWarning: selection.priceAvailable ? null : selection.priceMessage,
    });
  };

  const onSave = async () => {
    if (draftLocked || loadingDraft) {
      return;
    }

    if (lines.some((line) => !line.unitRecordId)) {
      setError('واحد اندازه‌گیری همه ردیف‌ها باید در کاتالوگ تعیین و کالا مجدداً انتخاب شود.');
      return;
    }

    if (!preview.canSave || !preview.fullPlan.ok) {
      setError(
        preview.fullPlan.ok
          ? PROBLEM_FALLBACK
          : preview.fullPlan.refusal.detail || PROBLEM_FALLBACK,
      );
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await callAppRoute(SAVE_DRAFT_ROUTE, {
        quotationId: editingQuotationId,
        expectedVersion: recordVersion,
        status: 'DRAFT',
        customerType,
        personId: customerType === 'PERSON' ? customerIds.personId : null,
        companyId: customerType === 'COMPANY' ? customerIds.companyId : null,
        name,
        paymentTerms,
        taxPolicy: taxPolicyCode,
        currencyCode: documentCurrencyCode,
        displayMoneyUnit: moneyUnit,
        documentDiscountKind,
        documentDiscountPercentText,
        documentDiscountAmountText,
        expiresAt: expiresAt.trim() || null,
        paymentDueDate: paymentDueDate.trim() || null,
        deliveryTerms: deliveryTerms.trim() || null,
        documentNotes: documentNotes.trim() || null,
        issuerLegalName: issuerLegalName.trim() || null,
        issuerNationalId: issuerNationalId.trim() || null,
        issuerEconomicCode: issuerEconomicCode.trim() || null,
        issuerAddress: issuerAddress.trim() || null,
        issuerPhone: issuerPhone.trim() || null,
        visitorName: visitorName.trim() || null,
        selectedPriceListId,
        selectedPriceListName,
        lines: lines.map((line) => ({
          clientLineId: line.clientLineId,
          catalogItemId: line.catalogItemId,
          kind: line.kind,
          name: line.name,
          description: line.description,
          unit: line.unit,
          unitRecordId: line.unitRecordId ?? null,
          quantityText: line.quantityText,
          unitPriceText: line.unitPriceText,
          moneyUnit,
          discountKind: line.discountKind,
          discountPercentText: line.discountPercentText,
          discountAmountText: line.discountAmountText,
          taxPolicy: line.taxPolicyCode,
          selectedPriceListId: line.selectedPriceListId,
          selectedPriceId: line.selectedPriceId,
          selectedPriceValidFrom: line.selectedPriceValidFrom,
        })),
      });

      if (!response.ok || response.data.success === false) {
        setError(
          toPersianUiMessage(response.data.message, PROBLEM_FALLBACK),
        );
        return;
      }

      const savedVersion =
        typeof response.data.version === 'number'
          ? response.data.version
          : recordVersion;

      // The write happens in an app route, so the browser cache behind this panel
      // still holds the old row. Without this the list would keep the previous
      // amount (or miss the new quotation) until a manual reload.
      await refreshRecordDataFromHost();

      if (editingQuotationId === null) {
        enqueueSnackbar({
          message: toPersianUiMessage(
            response.data.message,
            'پیش‌نویس ذخیره شد',
          ),
          variant: 'success',
        });
        closeSidePanel();
        return;
      }

      setRecordVersion(savedVersion);
      enqueueSnackbar({
        message: 'تغییرات پیش‌نویس ذخیره شد',
        variant: 'success',
      });
    } catch (saveFailure) {
      console.error('quotation-draft-form: save failed', saveFailure);
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setSaving(false);
    }
  };

  const customerHint =
    selectedCustomer === null
      ? `تا وقتی یک مشتری ${customerTypeLabel(customerType)} واقعی انتخاب نشود، ذخیره ممکن نیست.`
      : editingQuotationId !== null
        ? 'مشتری متصل به این پیش‌فاکتور؛ با «تغییر» می‌توانید آن را عوض کنید.'
        : sourceRecordId === ''
          ? 'مشتری از میان رکوردهای واقعی CRM انتخاب می‌شود.'
          : 'مشتری از رکوردی گرفته شده که فرم از آن باز شده است.';

  const isFormLocked = loadingDraft || draftLocked;
  const canSave =
    preview.canSave && !saving && !isFormLocked;
  const formSectionStyle: CSSProperties = isFormLocked
    ? { ...styles.section, opacity: 0.6, pointerEvents: 'none' }
    : styles.section;
  const addButtonStyle: CSSProperties = {
    ...styles.addLineButton,
    background: addHovered ? '#1d4ed8' : '#2563eb',
  };

  return (
    <div style={styles.root} className="qd-form" dir="rtl">
      <style>{RESPONSIVE_FORM_CSS}</style>
      <div style={styles.scrollBody}>
        <header style={styles.header}>
          <h2 style={styles.title}>
            {editingQuotationId !== null
              ? 'ویرایش پیش‌نویس'
              : isRecordEdit
                ? 'پیش‌فاکتور'
                : 'پیش‌فاکتور جدید'}
          </h2>
          <p style={styles.hint}>
            {isRecordEdit
              ? 'اطلاعات همین پیش‌فاکتور بارگذاری شده است. مبلغ نهایی با قاعدهٔ رُند انتخاب‌شده به پایین گرد می‌شود.'
              : 'کالا و خدمت را از کاتالوگ انتخاب کنید. مبلغ نهایی با قاعدهٔ رُند انتخاب‌شده به پایین گرد می‌شود.'}
          </p>
        </header>

        {loadingDraft ? (
          <p style={styles.meta}>در حال بارگذاری پیش‌فاکتور…</p>
        ) : null}
        {draftLocked ? (
          <p style={styles.warning}>
            این پیش‌فاکتور دیگر پیش‌نویس نیست و ویرایش مستقیم آن مجاز نیست؛
            برای تغییر وضعیت از تب «اقدامات» استفاده کنید.
          </p>
        ) : null}

        <section style={formSectionStyle} className="qd-section">
          <h3 style={styles.sectionTitle}>مشخصات</h3>
          <label style={styles.label}>
            عنوان
            <input
              style={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label style={styles.label} className="qd-field">
            نوع مشتری
            <select
              style={styles.input}
              value={customerType}
              onChange={(event) =>
                onCustomerTypeChange(
                  event.target.value as 'PERSON' | 'COMPANY',
                )
              }
            >
              <option value="PERSON">حقیقی</option>
              <option value="COMPANY">حقوقی</option>
            </select>
          </label>
          <label style={styles.label}>
            مشتری {customerTypeLabel(customerType)}
            <CustomerPicker
              customerType={customerType}
              selected={selectedCustomer}
              onSelect={onSelectCustomer}
              disabled={isFormLocked}
              fieldLabel={customerTypeLabel(customerType)}
            />
          </label>
          <p style={styles.meta}>{customerHint}</p>
          <label style={styles.label}>
            شرایط پرداخت
            <input
              style={styles.input}
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </label>
        </section>

        <section style={formSectionStyle} className="qd-section">
          <h3 style={styles.sectionTitle}>اطلاعات تجاری</h3>
          <div style={styles.row} className="qd-row">
            <label style={styles.label} className="qd-field">
              اعتبار پیش‌فاکتور تا
              <input
                style={styles.input}
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </label>
            <label style={styles.label} className="qd-field">
              سررسید پرداخت
              <input
                style={styles.input}
                type="date"
                value={paymentDueDate}
                onChange={(event) => setPaymentDueDate(event.target.value)}
              />
            </label>
          </div>
          <label style={styles.label}>
            فهرست قیمت
            <select
              style={styles.input}
              value={selectedPriceListId ?? ''}
              onChange={(event) => {
                const nextId = event.target.value.trim();
                const match = priceListOptions.find((row) => row.id === nextId);

                setSelectedPriceListId(nextId === '' ? null : nextId);
                setSelectedPriceListName(match?.name ?? null);
                if (nextId !== (selectedPriceListId ?? '')) {
                  // Prices from a different list cannot be represented as selected-list facts.
                  setLines(current => current.map(line => line.selectedPriceId ? {
                    ...line, unitPriceText: '', selectedPriceListId: null, selectedPriceId: null,
                    selectedPriceValidFrom: null, priceWarning: 'کالا را از فهرست قیمت جدید دوباره انتخاب کنید.',
                  } : line));
                }
              }}
            >
              {priceListOptions.length === 0 ? (
                <option value="">در حال بارگذاری…</option>
              ) : (
                priceListOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.isDefault ? ' — پیش‌فرض' : ''}
                  </option>
                ))
              )}
            </select>
          </label>
          <label style={styles.label}>
            شرایط تحویل
            <input
              style={styles.input}
              value={deliveryTerms}
              onChange={(event) => setDeliveryTerms(event.target.value)}
            />
          </label>
          <label style={styles.label}>
            یادداشت سند
            <textarea
              style={{ ...styles.input, minHeight: 72, resize: 'vertical' }}
              value={documentNotes}
              onChange={(event) => setDocumentNotes(event.target.value)}
            />
          </label>
          <label style={styles.label}>
            بازدیدکننده / فروشنده
            <input
              style={styles.input}
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
            />
          </label>
          <div style={styles.row} className="qd-row">
            <label style={styles.label} className="qd-field">
              نام صادرکننده
              <input
                style={styles.input}
                value={issuerLegalName}
                onChange={(event) => setIssuerLegalName(event.target.value)}
              />
            </label>
            <label style={styles.label} className="qd-field">
              شناسه ملی صادرکننده
              <input
                style={styles.input}
                value={issuerNationalId}
                onChange={(event) => setIssuerNationalId(event.target.value)}
              />
            </label>
          </div>
          <div style={styles.row} className="qd-row">
            <label style={styles.label} className="qd-field">
              کد اقتصادی صادرکننده
              <input
                style={styles.input}
                value={issuerEconomicCode}
                onChange={(event) => setIssuerEconomicCode(event.target.value)}
              />
            </label>
            <label style={styles.label} className="qd-field">
              تلفن صادرکننده
              <input
                style={styles.input}
                value={issuerPhone}
                onChange={(event) => setIssuerPhone(event.target.value)}
              />
            </label>
          </div>
          <label style={styles.label}>
            نشانی صادرکننده
            <input
              style={styles.input}
              value={issuerAddress}
              onChange={(event) => setIssuerAddress(event.target.value)}
            />
          </label>
        </section>

        <section style={formSectionStyle} className="qd-section">
          <h3 style={styles.sectionTitle}>ارز سند و نمایش مبلغ</h3>
          <div style={styles.row} className="qd-row">
            <label style={styles.label} className="qd-field">
              ارز سند
              <select
                style={styles.input}
                value={documentCurrencyCode}
                disabled={isFormLocked}
                onChange={(event) => {
                  documentCurrencyChosenByOperator.current = true;
                  setDocumentCurrencyCode(event.target.value.toUpperCase());
                }}
              >
                {(!MULTI_CURRENCY_DOCUMENTS
                  ? [
                      documentCurrencies.find(
                        (currency) =>
                          currency.code === OPERATIONAL_DOCUMENT_CURRENCY_CODE,
                      ) ?? {
                        code: OPERATIONAL_DOCUMENT_CURRENCY_CODE,
                        name: 'ریال ایران',
                        isDefault: true,
                        isActive: true,
                      },
                    ]
                  : documentCurrencies.length > 0
                    ? documentCurrencies.filter(
                        (currency) =>
                          currency.isActive ||
                          currency.code === documentCurrencyCode,
                      )
                    : [
                        {
                          code: OPERATIONAL_DOCUMENT_CURRENCY_CODE,
                          name: 'ریال ایران',
                          isDefault: true,
                          isActive: true,
                        },
                      ]
                ).map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.name} ({currency.code})
                    {currency.isDefault ? ' — پیش‌فرض' : ''}
                    {currency.isActive ? '' : ' — غیرفعال'}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label} className="qd-field">
              نمایش مبلغ به
              <select
                style={styles.input}
                value={moneyUnit}
                onChange={(event) =>
                  setMoneyUnit(event.target.value as MoneyUnit)
                }
              >
                <option value="TOMAN">تومان</option>
                <option value="IRR">ریال</option>
              </select>
            </label>
          </div>
          <p style={styles.meta}>
            ارز سند فعلاً فقط ریال ایران است. «نمایش مبلغ به» فقط مقیاس ورود و نمایش
            است و ارز سند را عوض نمی‌کند.
          </p>
        </section>

        <section style={formSectionStyle}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>ردیف‌های کالا و خدمت</h3>
            <button
              type="button"
              style={addButtonStyle}
              onMouseEnter={() => setAddHovered(true)}
              onMouseLeave={() => setAddHovered(false)}
              onClick={() =>
                setLines((current) => [...current, newLine(taxPolicyCode)])
              }
            >
              افزودن ردیف
            </button>
          </div>

          {lines.map((line, index) => {
            const linePreview = preview.linePreviews[index];
            const plannedLine = summaryPlan?.lines.find(
              (entry) => entry.clientLineId === line.clientLineId,
            );

            return (
              <div
                key={line.clientLineId}
                style={lineCardStyle(index)}
                className="qd-line-card"
              >
                <div style={styles.lineHeader}>
                  <strong style={styles.lineTitle}>ردیف {index + 1}</strong>
                  {line.sku ? (
                    <span style={styles.badge} dir="ltr">
                      {line.sku}
                    </span>
                  ) : null}
                </div>

                <label style={styles.fieldLabel}>
                  عنوان کالا / خدمت
                  <CatalogItemCombobox
                    moneyUnit={moneyUnit}
                    priceListId={selectedPriceListId}
                    selectedLabel={line.name}
                    onSelect={(selection) =>
                      applyCatalogSelection(line.clientLineId, selection)
                    }
                  />
                </label>

                {line.catalogItemId ? (
                  <p style={styles.meta}>
                    {line.kind === 'SERVICE' ? 'خدمت' : 'کالا'} · {line.unitRecordId ? line.unit : 'واحد نیازمند تعیین مرجع'}
                  </p>
                ) : null}

                {line.priceWarning ? (
                  <p style={styles.warning}>{line.priceWarning}</p>
                ) : null}

                <div style={styles.row} className="qd-row">
                  <label style={styles.fieldLabel} className="qd-field">
                    تعداد
                    <PersianPlainNumberInput
                      style={styles.fieldInput}
                      value={line.quantityText}
                      onValueChange={(quantityText) =>
                        updateLine(line.clientLineId, { quantityText })
                      }
                    />
                  </label>
                  <label style={styles.fieldLabel} className="qd-field">
                    قیمت واحد
                    <MoneyAmountInput
                      style={styles.fieldInput}
                      value={line.unitPriceText}
                      onValueChange={(unitPriceText) =>
                        updateLine(line.clientLineId, {
                          unitPriceText,
                          // Explicit edit converts catalog-sourced amount to manual price.
                          selectedPriceListId: null,
                          selectedPriceId: null,
                          selectedPriceValidFrom: null,
                          priceWarning: null,
                        })
                      }
                    />
                  </label>
                </div>

                <div style={styles.row} className="qd-row">
                  <label style={styles.fieldLabel} className="qd-field">
                    تخفیف ردیف
                    <select
                      style={styles.fieldInput}
                      value={line.discountKind}
                      onChange={(event) =>
                        updateLine(line.clientLineId, {
                          discountKind: event.target.value as DiscountKind,
                        })
                      }
                    >
                      <option value="NONE">بدون تخفیف</option>
                      <option value="RATE">درصدی</option>
                      <option value="AMOUNT">مبلغی</option>
                    </select>
                  </label>
                  {line.discountKind === 'RATE' ? (
                    <label style={styles.fieldLabel} className="qd-field">
                      درصد تخفیف
                      <PersianPlainNumberInput
                        style={styles.fieldInput}
                        value={line.discountPercentText}
                        onValueChange={(discountPercentText) =>
                          updateLine(line.clientLineId, {
                            discountPercentText,
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {line.discountKind === 'AMOUNT' ? (
                    <label style={styles.fieldLabel} className="qd-field">
                      مبلغ تخفیف
                      <MoneyAmountInput
                        style={styles.fieldInput}
                        value={line.discountAmountText}
                        onValueChange={(discountAmountText) =>
                          updateLine(line.clientLineId, {
                            discountAmountText,
                          })
                        }
                      />
                    </label>
                  ) : null}
                </div>

                <label style={styles.fieldLabel}>
                  سیاست مالیات و عوارض
                  <select
                    style={styles.fieldInput}
                    value={line.taxPolicyCode}
                    disabled={isFormLocked}
                    onChange={(event) =>
                      updateLine(line.clientLineId, {
                        taxPolicyCode: event.target.value,
                      })
                    }
                  >
                    {taxPolicyOptions.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.label}
                        {policy.isExempt ? ' — معاف' : ''}
                        {policy.isActive ? '' : ' — غیرفعال'}
                      </option>
                    ))}
                    {taxPolicyOptions.every(
                      (policy) => policy.id !== line.taxPolicyCode,
                    ) ? (
                      <option value={line.taxPolicyCode} dir="ltr">
                        {line.taxPolicyCode}
                      </option>
                    ) : null}
                  </select>
                </label>

                {plannedLine ? (
                  <div style={styles.lineTotals} className="qd-line-totals">
                    <div style={styles.lineTotalRow}>
                      <span>خالص مشمول مالیات</span>
                      <strong>
                        {formatPlanAmount(
                          plannedLine.amounts.netMicros,
                          moneyUnit,
                        )}
                      </strong>
                    </div>
                    <div style={styles.lineTotalRow}>
                      <span>مالیات</span>
                      <strong>
                        {formatPlanAmount(
                          plannedLine.amounts.taxOnlyMicros,
                          moneyUnit,
                        )}
                      </strong>
                    </div>
                    <div style={styles.lineTotalRow}>
                      <span>عوارض</span>
                      <strong>
                        {formatPlanAmount(
                          plannedLine.amounts.dutyMicros,
                          moneyUnit,
                        )}
                      </strong>
                    </div>
                    <div style={styles.lineTotalRow}>
                      <span>جمع ردیف</span>
                      <strong>
                        {formatPlanAmount(
                          plannedLine.amounts.totalMicros,
                          moneyUnit,
                        )}
                      </strong>
                    </div>
                  </div>
                ) : null}

                {linePreview && !linePreview.ok ? (
                  <p style={styles.lineError}>{linePreview.detail}</p>
                ) : null}

                {lines.length > 1 ? (
                  <button
                    type="button"
                    style={styles.linkButton}
                    onClick={() =>
                      setLines((current) =>
                        current.filter(
                          (entry) => entry.clientLineId !== line.clientLineId,
                        ),
                      )
                    }
                  >
                    حذف ردیف
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>

        <section style={styles.documentDiscountSection} className="qd-section">
          <h3 style={styles.sectionTitle}>تخفیف کل سند</h3>
          <p style={styles.meta}>
            مستقل از تخفیف داخل هر ردیف است و پس از جمع ردیف‌ها اعمال می‌شود.
          </p>
          <div style={styles.row} className="qd-row">
            <label style={styles.label} className="qd-field">
              نوع تخفیف کل
              <select
                style={styles.input}
                value={documentDiscountKind}
                onChange={(event) =>
                  setDocumentDiscountKind(event.target.value as DiscountKind)
                }
              >
                <option value="NONE">بدون تخفیف</option>
                <option value="RATE">درصدی</option>
                <option value="AMOUNT">مبلغی</option>
              </select>
            </label>
            {documentDiscountKind === 'RATE' ? (
              <label style={styles.label} className="qd-field">
                درصد تخفیف کل
                <PersianPlainNumberInput
                  style={styles.input}
                  value={documentDiscountPercentText}
                  onValueChange={setDocumentDiscountPercentText}
                />
              </label>
            ) : null}
            {documentDiscountKind === 'AMOUNT' ? (
              <label style={styles.label} className="qd-field">
                مبلغ تخفیف کل
                <MoneyAmountInput
                  style={styles.input}
                  value={documentDiscountAmountText}
                  onValueChange={setDocumentDiscountAmountText}
                />
              </label>
            ) : null}
          </div>
        </section>

        {error ? <p style={styles.error}>{error}</p> : null}
      </div>

      <div style={styles.stickyFooter}>
        <section style={styles.totalsBox}>
          <h3 style={styles.sectionTitle}>خلاصه مالی</h3>
          {summaryPlan ? (
            <>
              <div style={styles.totalsRow}>
                <span>جمع مبلغ ردیف‌ها</span>
                <strong>{summaryPlan.displayGross}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>تخفیف ردیف‌ها</span>
                <strong>{summaryPlan.displayLineDiscount}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>تخفیف کل سند</span>
                <strong>{summaryPlan.displayDocumentDiscount}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>جمع خالص پس از تخفیف‌ها</span>
                <strong>{summaryPlan.displayNet}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>مالیات</span>
                <strong>{summaryPlan.displayTaxOnly}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>عوارض</span>
                <strong>{summaryPlan.displayDuty}</strong>
              </div>
              <div style={styles.totalsRow}>
                <label style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <span>مبنای رُند کردن</span>
                  <select
                    value={roundingRuleCode ?? ''}
                    onChange={(event) => {
                      roundingRuleChosenByOperator.current = true;
                      setRoundingRuleCode(event.target.value || null);
                    }}
                    style={styles.input}
                    disabled={isFormLocked}
                  >
                    {storedRoundingRule !== null &&
                    !roundingRules.some(
                      (rule) => rule.id === storedRoundingRule.code,
                    ) ? (
                      <option value={storedRoundingRule.code}>
                        {storedRoundingRule.name} (
                        {formatExactDecimalForPeople(
                          storedRoundingRule.stepRials.toString(),
                        )}{' '}
                        ریال)
                      </option>
                    ) : null}
                    {roundingRules
                      .filter((rule) => rule.isActive)
                      .map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.label} (
                          {formatExactDecimalForPeople(
                            rule.stepRials.toString(),
                          )}{' '}
                          ریال)
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div style={styles.totalsRow}>
                <span>
                  کسر بابت رُند ({summaryPlan.displayRoundingStepLabel})
                </span>
                <strong>{summaryPlan.displayRounding}</strong>
              </div>
              <div style={styles.payable}>
                <span>مبلغ نهایی قابل پرداخت</span>
                <strong>{summaryPlan.displayTotal}</strong>
              </div>
              {!preview.canSave ? (
                <p style={styles.meta}>
                  جمع بالا مربوط به ردیف‌های معتبر است. تا تکمیل همهٔ ردیف‌ها ذخیره
                  ممکن نیست.
                </p>
              ) : null}
            </>
          ) : (
            <p style={styles.meta}>
              {summaryRefusal ??
                'پس از انتخاب حداقل یک کالای معتبر، خلاصه مالی اینجا نمایش داده می‌شود.'}
            </p>
          )}
        </section>

        <div style={styles.actions} className="qd-actions">
          {isRecordEdit ? null : (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={closeSidePanel}
            >
              بستن
            </button>
          )}
          <button
            type="button"
            style={{
              ...styles.primaryButton,
              opacity: canSave ? 1 : 0.55,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSave}
            onClick={() => void onSave()}
          >
            {saving
              ? 'در حال ذخیره…'
              : editingQuotationId !== null
                ? 'ذخیره تغییرات'
                : 'ذخیره پیش‌نویس'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1a1a1a',
  },
  scrollBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  hint: { margin: 0, color: '#666', fontSize: 12, lineHeight: 1.7 },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 4,
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 650 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 13,
    fontWeight: 600,
    color: '#222',
    flex: 1,
    minWidth: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d0d0d0',
    fontSize: 14,
    background: '#fff',
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #c5cdd8',
    fontSize: 15,
    fontWeight: 500,
    background: '#fff',
    color: '#111',
  },
  row: { display: 'flex', gap: 8, minWidth: 0, flexWrap: 'wrap' },
  meta: { margin: 0, fontSize: 11, color: '#777', lineHeight: 1.5 },
  documentDiscountSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
  },
  lineCard: {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0,
  },
  lineTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid #e2e8f0',
  },
  lineTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    fontSize: 12,
    color: '#334155',
  },
  lineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  lineTitle: { fontSize: 13, fontWeight: 700 },
  badge: {
    fontSize: 11,
    color: '#475569',
    background: '#e2e8f0',
    borderRadius: 6,
    padding: '2px 8px',
    direction: 'ltr',
    unicodeBidi: 'isolate',
  },
  warning: { margin: 0, color: '#9a6700', fontSize: 12, lineHeight: 1.5 },
  lineError: { margin: 0, color: '#b42318', fontSize: 12 },
  stickyFooter: {
    flexShrink: 0,
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
    boxShadow: '0 -6px 16px rgba(15, 23, 42, 0.04)',
  },
  totalsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 16px 4px',
    background: '#fafbfc',
  },
  totalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: '#444',
    fontSize: 13,
  },
  payable: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
    paddingTop: 8,
    borderTop: '1px solid #e0e0e0',
    fontSize: 15,
    fontWeight: 700,
  },
  error: { color: '#b42318', margin: 0, fontSize: 13 },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '10px 16px 12px',
    background: '#fff',
  },
  primaryButton: {
    background: '#1a1a1a',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 13,
  },
  secondaryButton: {
    background: '#f5f5f5',
    color: '#1a1a1a',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 13,
  },
  addLineButton: {
    background: '#2563eb',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 650,
  },
  linkButton: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 0,
    color: '#b42318',
    cursor: 'pointer',
    padding: 0,
    fontSize: 12,
  },
};
