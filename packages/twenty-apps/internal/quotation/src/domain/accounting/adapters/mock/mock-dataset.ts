import { type RemoteCatalogItem, type RemoteParty } from 'src/domain/accounting/adapter-contract';

// The demo catalog the mock adapter answers with. It is deliberately NOT a list of happy-path
// rows: a person testing the import screen must be able to see every refusal and every
// mismatch the planner can produce, without a vendor server and without internet access.
//
// The shapes below are chosen for their effect on the preview:
//   - `1001` and `1003` share a name with different prices -> DUPLICATE_REMOTE_NAME and a
//     visible CRM/destination price difference;
//   - `2004` appears twice as a code -> DUPLICATE_REMOTE_CODE, refused before any writing;
//   - `X-901` and `-5` cannot become a numeric vendor product -> REMOTE_ID_NOT_NUMERIC;
//   - `5001` carries no price -> the row explains that the amount is unknown instead of
//     publishing a free product;
//   - `7001` is inactive -> an inactive destination item is visible before it is linked.
const item = ({
  externalItemId,
  code,
  name,
  sellPriceUnits,
  stock,
  remoteVersion,
  secondaryName = null,
  salesPriceUnits = [],
  isActive = true,
}: {
  externalItemId: string;
  code: string;
  name: string;
  sellPriceUnits: number | null;
  stock: number | null;
  remoteVersion: string;
  secondaryName?: string | null;
  salesPriceUnits?: number[];
  isActive?: boolean;
}): RemoteCatalogItem => ({
  externalItemId,
  code,
  name,
  secondaryName,
  sellPriceUnits,
  salesPriceUnits,
  stock,
  remoteVersion,
  isActive,
});

export const MOCK_CATALOG_ITEMS: RemoteCatalogItem[] = [
  item({ externalItemId: '1001', code: '1001', name: 'کابل شبکه CAT6', sellPriceUnits: 450_000, stock: 12, remoteVersion: 'mock-cat6-v1' }),
  item({ externalItemId: '1002', code: '1002', name: 'خدمت نصب و راه‌اندازی', sellPriceUnits: 2_000_000, stock: null, remoteVersion: 'mock-install-v1' }),
  // Same name, different code and price: the duplicate-name warning exists for this pair.
  item({ externalItemId: '1003', code: '1003', name: 'کابل شبکه CAT6', sellPriceUnits: 470_000, stock: 4, remoteVersion: 'mock-cat6-v2' }),
  item({ externalItemId: '1004', code: '1004', name: 'سوکت شبکه RJ45', sellPriceUnits: 90_000, stock: 240, remoteVersion: 'mock-rj45-v1' }),
  item({ externalItemId: '1005', code: '1005', name: 'پچ پنل ۲۴ پورت', sellPriceUnits: 1_850_000, stock: 7, remoteVersion: 'mock-patch-v1' }),
  item({ externalItemId: '1006', code: '1006', name: 'سوییچ ۸ پورت', sellPriceUnits: 3_200_000, stock: 9, remoteVersion: 'mock-switch8-v1' }),
  item({ externalItemId: '1007', code: '1007', name: 'روتر بی‌سیم', sellPriceUnits: 5_400_000, stock: 3, remoteVersion: 'mock-router-v1' }),
  item({ externalItemId: '1008', code: '1008', name: 'هارد SSD 512GB', sellPriceUnits: 4_100_000, stock: 15, remoteVersion: 'mock-ssd-v1' }),
  item({ externalItemId: '1009', code: '1009', name: 'رم 16GB', sellPriceUnits: 2_600_000, stock: 22, remoteVersion: 'mock-ram-v1' }),
  item({ externalItemId: '1010', code: '1010', name: 'ماوس بی‌سیم', sellPriceUnits: 620_000, stock: 48, remoteVersion: 'mock-mouse-v1' }),
  item({ externalItemId: '1011', code: '1011', name: 'کیبورد مکانیکی', sellPriceUnits: 1_450_000, stock: 18, remoteVersion: 'mock-keyboard-v1' }),
  item({ externalItemId: '1012', code: '1012', name: 'مانیتور ۲۴ اینچ', sellPriceUnits: 7_800_000, stock: 6, remoteVersion: 'mock-monitor-v1' }),
  item({ externalItemId: '1013', code: '1013', name: 'پرینتر لیزری', sellPriceUnits: 12_500_000, stock: 2, remoteVersion: 'mock-printer-v1' }),
  item({ externalItemId: '1014', code: '1014', name: 'کارتریج مشکی', sellPriceUnits: 2_450_000, stock: 11, remoteVersion: 'mock-toner-v1' }),
  item({ externalItemId: '1015', code: '1015', name: 'کاغذ A4 (بستهٔ ۵۰۰)', sellPriceUnits: 780_000, stock: 60, remoteVersion: 'mock-paper-v1' }),
  item({ externalItemId: '1016', code: '1016', name: 'UPS 1000VA', sellPriceUnits: 6_900_000, stock: 5, remoteVersion: 'mock-ups-v1' }),
  item({ externalItemId: '1017', code: '1017', name: 'دوربین مداربسته', sellPriceUnits: 4_800_000, stock: 8, remoteVersion: 'mock-camera-v1' }),
  item({ externalItemId: '1018', code: '1018', name: 'ضبط‌کنندهٔ ۸ کانال', sellPriceUnits: 7_300_000, stock: 4, remoteVersion: 'mock-dvr-v1' }),
  item({ externalItemId: '1019', code: '1019', name: 'کابل برق سه‌شاخه', sellPriceUnits: 210_000, stock: 130, remoteVersion: 'mock-power-v1' }),
  item({ externalItemId: '1020', code: '1020', name: 'خدمات پشتیبانی ماهانه', sellPriceUnits: 1_500_000, stock: null, remoteVersion: 'mock-support-v1' }),
  item({ externalItemId: '1021', code: '1021', name: 'خدمات طراحی شبکه', sellPriceUnits: 6_500_000, stock: null, remoteVersion: 'mock-design-v1' }),
  item({ externalItemId: '1022', code: '1022', name: 'نصب ویندوز و نرم‌افزار', sellPriceUnits: 950_000, stock: null, remoteVersion: 'mock-windows-v1' }),
  item({ externalItemId: '1023', code: '1023', name: 'عیب‌یابی شبکه (ساعت)', sellPriceUnits: 480_000, stock: null, remoteVersion: 'mock-troubleshoot-v1' }),
  item({ externalItemId: '1024', code: '1024', name: 'آموزش کاربران (جلسه)', sellPriceUnits: 2_200_000, stock: null, remoteVersion: 'mock-training-v1' }),
  item({ externalItemId: '2001', code: '2001', name: 'لایسنس آنتی‌ویروس یک‌ساله', sellPriceUnits: 1_900_000, stock: null, remoteVersion: 'mock-antivirus-v1' }),
  item({ externalItemId: '2002', code: '2002', name: 'لایسنس آفیس', sellPriceUnits: 5_400_000, stock: null, remoteVersion: 'mock-office-v1' }),
  item({ externalItemId: '2003', code: '2003', name: 'اشتراک پشتیبانی سالانه', sellPriceUnits: 12_000_000, stock: null, remoteVersion: 'mock-annual-v1' }),
  // One code, two remote records: no row may be linked until the vendor is cleaned up.
  item({ externalItemId: '3001', code: '2004', name: 'کابل فیبر نوری', sellPriceUnits: 3_900_000, stock: 3, remoteVersion: 'mock-fiber-v1' }),
  item({ externalItemId: '3002', code: '2004', name: 'کیست کابل فیبر', sellPriceUnits: 450_000, stock: 20, remoteVersion: 'mock-fiber-box-v1' }),
  // No price on the destination: the preview must say the amount is unknown.
  item({ externalItemId: '5001', code: '5001', name: 'خدمت مشاورهٔ اختصاصی', sellPriceUnits: null, stock: null, remoteVersion: 'mock-consult-v1' }),
  // Identifiers that cannot become a numeric vendor product code.
  item({ externalItemId: 'X-901', code: 'X-901', name: 'کالای با شناسهٔ نامعتبر', sellPriceUnits: 120_000, stock: 1, remoteVersion: 'mock-invalid-id-v1' }),
  item({ externalItemId: '-5', code: '-5', name: 'کالای با شناسهٔ منفی', sellPriceUnits: 1_000, stock: 1, remoteVersion: 'mock-negative-id-v1' }),
  // An inactive destination record is still returned; the CRM must see it before linking.
  item({ externalItemId: '7001', code: '7001', name: 'کالای غیرفعال آزمایشی', sellPriceUnits: 300_000, stock: 0, remoteVersion: 'mock-inactive-v1', isActive: false }),
];

const party = ({
  externalPartyId,
  code,
  fullName,
  mobile,
  nationalCode,
  remoteVersion,
}: {
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  remoteVersion: string;
}): RemoteParty => ({
  externalPartyId,
  code,
  fullName,
  mobile,
  nationalCode,
  remoteVersion,
});

export const MOCK_PARTIES: RemoteParty[] = [
  party({ externalPartyId: '101', code: '101', fullName: 'شرکت نمونهٔ آزمون', mobile: '09120000000', nationalCode: '10101010101', remoteVersion: 'mock-party-1' }),
  party({ externalPartyId: '102', code: '102', fullName: 'شرکت فناوری پارس', mobile: '09121000002', nationalCode: '10201010202', remoteVersion: 'mock-party-2' }),
  // Two destination customers share a national code: the duplicate is reported, not merged.
  party({ externalPartyId: '103', code: '103', fullName: 'شرکت داده‌گستر', mobile: '09121000003', nationalCode: '10301010303', remoteVersion: 'mock-party-3' }),
  party({ externalPartyId: '104', code: '104', fullName: 'شرکت داده‌گستر (شعبه)', mobile: '09121000004', nationalCode: '10301010303', remoteVersion: 'mock-party-4' }),
  party({ externalPartyId: '105', code: '105', fullName: 'رضا محمدی', mobile: '09121000005', nationalCode: '0012345678', remoteVersion: 'mock-party-5' }),
  party({ externalPartyId: '106', code: '106', fullName: 'سارا احمدی', mobile: '09121000006', nationalCode: '0012345679', remoteVersion: 'mock-party-6' }),
  party({ externalPartyId: '107', code: '107', fullName: 'شرکت راه‌حل هوشمند', mobile: '09121000007', nationalCode: '10701010707', remoteVersion: 'mock-party-7' }),
  party({ externalPartyId: '108', code: '108', fullName: 'فروشگاه رایانه مرکزی', mobile: '09121000008', nationalCode: '10801010808', remoteVersion: 'mock-party-8' }),
  party({ externalPartyId: '109', code: '109', fullName: 'شرکت مهندسی آریا', mobile: '09121000009', nationalCode: '10901010909', remoteVersion: 'mock-party-9' }),
  party({ externalPartyId: '110', code: '110', fullName: 'مؤسسهٔ آموزشی دانش', mobile: '09121000010', nationalCode: '11001011010', remoteVersion: 'mock-party-10' }),
  party({ externalPartyId: '111', code: '111', fullName: 'علی کریمی', mobile: '09121000011', nationalCode: '0011111111', remoteVersion: 'mock-party-11' }),
  party({ externalPartyId: '112', code: '112', fullName: 'مریم رضایی', mobile: '09121000012', nationalCode: '0011111112', remoteVersion: 'mock-party-12' }),
  party({ externalPartyId: '113', code: '113', fullName: 'شرکت بازرگانی نیک', mobile: '09121000013', nationalCode: '11301011313', remoteVersion: 'mock-party-13' }),
  party({ externalPartyId: '114', code: '114', fullName: 'شرکت حمل‌ونقل سریع', mobile: '09121000014', nationalCode: '11401011414', remoteVersion: 'mock-party-14' }),
  party({ externalPartyId: '115', code: '115', fullName: 'بیمارستان مهر', mobile: '09121000015', nationalCode: '11501011515', remoteVersion: 'mock-party-15' }),
  party({ externalPartyId: '116', code: '116', fullName: 'کلینیک سلامت', mobile: '09121000016', nationalCode: '11601011616', remoteVersion: 'mock-party-16' }),
  party({ externalPartyId: '117', code: '117', fullName: 'شرکت ساختمانی آبان', mobile: '09121000017', nationalCode: '11701011717', remoteVersion: 'mock-party-17' }),
  party({ externalPartyId: '118', code: '118', fullName: 'شرکت خدمات مالی کیان', mobile: '09121000018', nationalCode: '11801011818', remoteVersion: 'mock-party-18' }),
  // Duplicate destination identifier: both rows are unusable until corrected in the vendor.
  party({ externalPartyId: '101', code: '101-dup', fullName: 'شرکت نمونهٔ آزمون — دفتر دوم', mobile: '09121000019', nationalCode: '10101010199', remoteVersion: 'mock-party-19' }),
  // A destination customer with no national code cannot be matched automatically.
  party({ externalPartyId: '120', code: '120', fullName: 'بهنام نوری', mobile: '09121000020', nationalCode: null, remoteVersion: 'mock-party-20' }),
  party({ externalPartyId: '121', code: '121', fullName: 'شرکت بدون کد ملی', mobile: '09121000021', nationalCode: null, remoteVersion: 'mock-party-21' }),
  party({ externalPartyId: '122', code: '122', fullName: 'شرکت صنایع غذایی سپید', mobile: '09121000022', nationalCode: '12201012222', remoteVersion: 'mock-party-22' }),
];

// The four rates the UAT script asks a person to exercise. They are samples, not a statement
// about Iranian tax law; a workspace decides its own policies and maps them to vendor codes.
export const MOCK_TAX_RATE_SAMPLES = [0, 9, 10, 10.5] as const;

type MockOperationHistorySample = {
  state: 'SUCCEEDED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'MANUAL_EXPORT_REQUIRED';
  kind: 'PUSH_QUOTATION' | 'IMPORT_ITEM' | 'IMPORT_PARTY';
  reference: string;
  attempts: number;
  message: string;
};

// Outcomes a person must be able to read before a real vendor exists. Rendered from this
// fixture only: the settings page shows them without creating an operation row, so the
// history table in PostgreSQL stays an honest record of what actually ran.
export const MOCK_OPERATION_HISTORY_SAMPLES: readonly MockOperationHistorySample[] = [
  {
    state: 'SUCCEEDED',
    kind: 'PUSH_QUOTATION',
    reference: 'QT-1405-000052',
    attempts: 1,
    message: 'سند نمایشی در مقصد ثبت شد.',
  },
  {
    state: 'FAILED_RETRYABLE',
    kind: 'IMPORT_ITEM',
    reference: '2004',
    attempts: 2,
    message: 'پاسخ موقت مقصد؛ تلاش بعدی مجاز است.',
  },
  {
    state: 'FAILED_FINAL',
    kind: 'PUSH_QUOTATION',
    reference: 'QT-1405-000048',
    attempts: 3,
    message: 'کد مالیات مقصد نگاشت نشده است؛ تلاش خودکار متوقف شد.',
  },
  {
    state: 'MANUAL_EXPORT_REQUIRED',
    kind: 'PUSH_QUOTATION',
    reference: 'QT-1405-000051',
    attempts: 1,
    message: 'مقصد ثبت مستقیم را پشتیبانی نمی‌کند؛ خروجی دستی لازم است.',
  },
];
