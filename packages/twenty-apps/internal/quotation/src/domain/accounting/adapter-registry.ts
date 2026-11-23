import {
  ACCOUNTING_ADAPTER_CONTRACT_VERSION,
  isAccountingAdapterId,
  type AccountingAdapter,
  type AccountingAdapterId,
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';
import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import {
  type AsanFetch,
  AsanHttpAdapter,
} from 'src/domain/accounting/adapters/asan/asan-http-adapter';
import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import {
  DEFAULT_MOCK_PROFILE,
  isMockProfile,
  MOCK_PROFILE_DESCRIPTIONS,
  MOCK_PROFILES,
  mockProfileCapabilities,
} from 'src/domain/accounting/adapters/mock/mock-profiles';
import {
  isCurrencyHandlingMode,
  isTaxHandlingMode,
  type CurrencyHandlingMode,
  type TaxHandlingMode,
} from 'src/domain/accounting/capabilities';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// What the connection panel can offer, and what each choice honestly is. `LIVE_UNVERIFIED`
// is not a warning label invented for this report: it is the state of an adapter whose
// endpoints come from documentation but which has never answered a real server, so no
// result it produces may be presented as a proven live sync.
export type AdapterReadiness = 'MOCK_ONLY' | 'LIVE_UNVERIFIED' | 'LIVE_VERIFIED';

export type AdapterDescriptor = {
  id: AccountingAdapterId;
  label: string;
  vendor: string;
  contractVersion: string;
  isLive: boolean;
  transportIsSecure: boolean;
  readiness: AdapterReadiness;
  summary: string;
  limitations: readonly string[];
  // What this destination reads for tax and currency, so the panel can render the fields
  // that exist instead of asking for ones the vendor never reads. `null` for the mock
  // because a mock connection carries its own profile; a real adapter declares one contract.
  taxHandling: TaxHandlingMode | null;
  currencyHandling: CurrencyHandlingMode | null;
  baseCurrency: string;
  // Whether tax and discount travel as their own pre-existing item rows. The panel asks for
  // the row code only when this is true; a vendor with real fields must not be asked.
  requiresSpecialItemCodes: boolean;
  // The closed set of destinations this adapter can stand in for. Empty for a real vendor.
  testProfiles: readonly {
    id: string;
    label: string;
    summary: string;
    taxHandling: TaxHandlingMode;
    currencyHandling: CurrencyHandlingMode;
    baseCurrency?: string;
    requiresSpecialItemCodes: boolean;
  }[];
};

export const ADAPTER_DESCRIPTORS: readonly AdapterDescriptor[] = [
  {
    id: 'asan',
    label: 'آسان (LinqToAsan)',
    vendor: 'آسان',
    contractVersion: ACCOUNTING_ADAPTER_CONTRACT_VERSION,
    isLive: true,
    transportIsSecure: false,
    readiness: 'LIVE_UNVERIFIED',
    summary:
      'اتصال به API مستند آسان: کالا، مشتری، قیمت و ثبت پیش‌فاکتور. تا پاسخ سرور واقعی، وضعیت «فعال، تأییدنشده» است.',
    limitations: [
      'آسان فقط قیمت کالا را ویرایش می‌کند؛ تغییر نام کالا از CRM منتشر نمی‌شود.',
      'حذف یا غیرفعال‌سازی کالا در API مستند وجود ندارد و باید در آسان انجام شود.',
      'آسان شمارهٔ سند را خودش تخصیص می‌دهد و کلید Idempotency ندارد؛ تلاش دوباره پس از خطای نامشخص نیازمند بررسی دستی است.',
      'مستندات آسان انتقال امن یا احراز هویت ندارد؛ تا تأیید تونل، ارسال انجام نمی‌شود.',
      'واحد مبلغ (ریال/تومان) در مستندات مشخص نیست و باید توسط حسابدار تأیید شود.',
      'مالیات در آسان یک ردیف کد ویژه است: هم کد ردیف مالیات و هم مبلغ آن لازم است؛ نرخ مالیات از سیاست CRM خوانده می‌شود و به آسان فرستاده نمی‌شود.',
      'آسان کد ارز ندارد و همه مبالغ را به یک ارز ثبت می‌کند؛ کد ارز از کاربر خواسته نمی‌شود.',
    ],
    taxHandling: ASAN_CAPABILITIES.taxHandling,
    currencyHandling: ASAN_CAPABILITIES.currencyHandling,
    baseCurrency: ASAN_CAPABILITIES.baseCurrency,
    requiresSpecialItemCodes: ASAN_CAPABILITIES.requiresSpecialItemCodes,
    testProfiles: [],
  },
  {
    id: 'mock',
    label: 'آزمایشی (Mock)',
    vendor: '—',
    contractVersion: ACCOUNTING_ADAPTER_CONTRACT_VERSION,
    isLive: false,
    transportIsSecure: true,
    readiness: 'MOCK_ONLY',
    summary:
      'اتصال آزمایشی با داده‌های ثابت برای تمرین پیش‌نمایش و آزمون. هیچ داده‌ای به بیرون ارسال نمی‌شود.',
    limitations: [
      'داده‌ها ثابت و در حافظه است؛ نتیجه برای آزمون است، نه حسابداری واقعی.',
      'پاسخ‌های آسان را شبیه‌سازی نمی‌کند؛ قرارداد پاسخ آسان جداگانه آزمون می‌شود.',
    ],
    taxHandling: null,
    currencyHandling: null,
    baseCurrency: '',
    requiresSpecialItemCodes: ASAN_CAPABILITIES.requiresSpecialItemCodes,
    testProfiles: MOCK_PROFILES.map((profile) => ({
      id: profile,
      label: MOCK_PROFILE_DESCRIPTIONS[profile].label,
      summary: MOCK_PROFILE_DESCRIPTIONS[profile].summary,
      taxHandling: MOCK_PROFILE_DESCRIPTIONS[profile].tax,
      currencyHandling: MOCK_PROFILE_DESCRIPTIONS[profile].currency,
      baseCurrency:
        mockProfileCapabilities(profile).baseCurrency,
      requiresSpecialItemCodes:
        mockProfileCapabilities(profile).requiresSpecialItemCodes,
    })),
  },
];

// The financial contract a connection actually has. A stored capability wins for a real
// adapter (it is the evidence of what was configured); a mock reads its profile, because the
// profile is the thing that decides which contract it stands in for.
export const financialModesFor = (
  adapterId: string,
  options: { profile?: unknown; capabilities?: unknown } = {},
): { taxHandling: TaxHandlingMode; currencyHandling: CurrencyHandlingMode; baseCurrency: string } => {
  const stored = options.capabilities;

  if (
    stored !== null &&
    typeof stored === 'object' &&
    isTaxHandlingMode((stored as Record<string, unknown>).taxHandling) &&
    isCurrencyHandlingMode((stored as Record<string, unknown>).currencyHandling)
  ) {
    const record = stored as Record<string, unknown>;

    return {
      taxHandling: record.taxHandling as TaxHandlingMode,
      currencyHandling: record.currencyHandling as CurrencyHandlingMode,
      baseCurrency:
        typeof record.baseCurrency === 'string' ? record.baseCurrency : '',
    };
  }

  if (adapterId === 'mock') {
    const profile = isMockProfile(options.profile)
      ? options.profile
      : DEFAULT_MOCK_PROFILE;
    const capabilities = mockProfileCapabilities(profile);

    return {
      taxHandling: capabilities.taxHandling,
      currencyHandling: capabilities.currencyHandling,
      baseCurrency: capabilities.baseCurrency,
    };
  }

  return {
    taxHandling: ASAN_CAPABILITIES.taxHandling,
    currencyHandling: ASAN_CAPABILITIES.currencyHandling,
    baseCurrency: ASAN_CAPABILITIES.baseCurrency,
  };
};

export const findAdapterDescriptor = (
  adapterId: string,
): AdapterDescriptor | null =>
  ADAPTER_DESCRIPTORS.find((descriptor) => descriptor.id === adapterId) ?? null;

export type CreateAdapterInput = {
  adapterId: unknown;
  settings: ConnectionSettings;
  tunnelToken?: string;
  allowInsecureTransport?: boolean;
  fetchImpl?: AsanFetch;
  now?: () => Date;
  // Test seam: replaces the vendor implementation without asking the factory to guess.
  mock?: MockAccountingAdapter;
};

export const createAccountingAdapter = (
  input: CreateAdapterInput,
): Result<AccountingAdapter> => {
  if (!isAccountingAdapterId(input.adapterId)) {
    return refused(
      'ADAPTER_UNKNOWN',
      'the selected accounting adapter is not implemented',
    );
  }

  if (input.adapterId === 'mock') {
    return accepted(
      input.mock ??
        new MockAccountingAdapter({
          profile: input.settings.financial?.mockProfile,
        }),
    );
  }

  if (input.settings.baseUrl.trim() === '') {
    return refused(
      'ADAPTER_NOT_CONFIGURED',
      'the Asan adapter needs a service address',
    );
  }

  return accepted(
    new AsanHttpAdapter({
      baseUrl: input.settings.baseUrl,
      remoteUserId: input.settings.remoteUserId,
      ...(input.tunnelToken === undefined
        ? {}
        : { tunnelToken: input.tunnelToken }),
      ...(input.allowInsecureTransport === true
        ? { allowInsecureTransport: true }
        : {}),
      ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }),
      ...(input.now === undefined ? {} : { now: input.now }),
    }),
  );
};

// The capabilities as a flat checklist for the panel. A boolean is never enough on its own:
// the update scope is spelled out because "can update" plus "only prices" is the difference
// between a published rename and a lie.
export type CapabilityRow = {
  area: 'items' | 'parties' | 'documents' | 'financial' | 'transport';
  key: string;
  label: string;
  value: string;
};

export const TAX_HANDLING_LABELS: Record<TaxHandlingMode, string> = {
  TAX_RATE: 'فقط نرخ مالیات',
  TAX_AMOUNT: 'فقط مبلغ مالیات',
  TAX_CODE: 'فقط کد مالیات',
  TAX_CODE_AND_AMOUNT: 'کد و مبلغ مالیات',
  UNSUPPORTED: 'بدون پشتیبانی مالیات',
};

export const CURRENCY_HANDLING_LABELS: Record<CurrencyHandlingMode, string> = {
  SINGLE_CURRENCY: 'تک‌ارزی (بدون کد ارز)',
  CURRENCY_CODE: 'کد ارز',
  CURRENCY_NAME: 'نام ارز',
  CURRENCY_CODE_AND_RATE: 'کد ارز و نرخ تبدیل',
  UNSUPPORTED: 'قرارداد ارزی نامشخص',
};

export const describeCapabilities = (
  descriptor: Pick<AdapterDescriptor, 'transportIsSecure'>,
  capabilities = ASAN_CAPABILITIES,
): CapabilityRow[] => {
  const yesNo = (value: boolean): string => (value ? 'دارد' : 'ندارد');

  return [
    { area: 'items', key: 'list', label: 'خواندن فهرست کالا', value: yesNo(capabilities.items.list) },
    { area: 'items', key: 'read', label: 'خواندن یک کالا', value: yesNo(capabilities.items.read) },
    { area: 'items', key: 'create', label: 'ایجاد کالا', value: yesNo(capabilities.items.create) },
    {
      area: 'items',
      key: 'updateFields',
      label: 'دامنهٔ ویرایش کالا',
      value:
        capabilities.items.updateFields === 'ALL'
          ? 'همهٔ فیلدها'
          : capabilities.items.updateFields === 'PRICE_ONLY'
            ? 'فقط قیمت'
            : 'ویرایش ندارد',
    },
    { area: 'items', key: 'delete', label: 'حذف/غیرفعال‌سازی کالا', value: yesNo(capabilities.items.delete) },
    { area: 'items', key: 'listPrices', label: 'خواندن قیمت‌ها', value: yesNo(capabilities.items.listPrices) },
    { area: 'parties', key: 'list', label: 'خواندن مشتریان', value: yesNo(capabilities.parties.list) },
    { area: 'parties', key: 'create', label: 'ایجاد مشتری', value: yesNo(capabilities.parties.create) },
    { area: 'parties', key: 'update', label: 'ویرایش مشتری', value: yesNo(capabilities.parties.update) },
    {
      area: 'parties',
      key: 'returnsAssignedCode',
      label: 'بازگرداندن کد تخصیصی پس از ایجاد',
      value: yesNo(capabilities.parties.returnsAssignedCode),
    },
    {
      area: 'documents',
      key: 'createProforma',
      label: 'ثبت پیش‌فاکتور',
      value: yesNo(capabilities.documents.createProforma),
    },
    {
      area: 'documents',
      key: 'remoteIdempotency',
      label: 'جلوگیری از تکرار در مقصد',
      value: yesNo(capabilities.documents.remoteIdempotency),
    },
    {
      area: 'documents',
      key: 'readById',
      label: 'خواندن سند با شناسه',
      value: yesNo(capabilities.documents.readById),
    },
    {
      area: 'financial',
      key: 'taxHandling',
      label: 'قرارداد مالیات مقصد',
      value: TAX_HANDLING_LABELS[capabilities.taxHandling],
    },
    {
      area: 'financial',
      key: 'currencyHandling',
      label: 'قرارداد ارز مقصد',
      value: CURRENCY_HANDLING_LABELS[capabilities.currencyHandling],
    },
    {
      area: 'financial',
      key: 'baseCurrency',
      label: 'ارز پایهٔ مقصد',
      value: capabilities.baseCurrency === '' ? 'کد ارز لازم است' : capabilities.baseCurrency,
    },
    {
      area: 'transport',
      key: 'transportIsSecure',
      label: 'انتقال امن',
      value: yesNo(descriptor.transportIsSecure),
    },
  ];
};
