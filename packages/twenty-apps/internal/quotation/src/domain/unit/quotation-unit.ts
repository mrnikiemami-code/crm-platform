import { accepted, refused, type Result } from 'src/domain/shared/result';

export type QuotationUnitCatalogRow = {
  recordId: string;
  code: string;
  name: string;
  isActive: boolean;
  accountingCode: string;
};

const MAX_NAME_LENGTH = 120;
const ACCOUNTING_CODE_PATTERN = /^[0-9A-Za-z\u0600-\u06FF][0-9A-Za-z\u0600-\u06FF._\-/]*$/;

export const validateQuotationUnitName = (name: string): Result<string> => {
  const trimmed = name.trim();

  if (trimmed === '') {
    return refused('QUOTATION_UNIT_NAME_REQUIRED', 'نام واحد الزامی است');
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return refused(
      'QUOTATION_UNIT_NAME_TOO_LONG',
      'نام واحد بیش از حد طولانی است',
    );
  }

  return accepted(trimmed);
};

// Normalized accounting codes must stay text; leading zeros matter for vendor parity.
export const validateQuotationUnitAccountingCode = (
  accountingCodeText: string,
): Result<string> => {
  const trimmed = accountingCodeText.trim();

  if (trimmed === '') {
    return accepted('');
  }

  if (trimmed.length > 32) {
    return refused(
      'ACCOUNTING_CODE_TOO_LONG',
      'کد حسابداری واحد بیش از حد طولانی است',
    );
  }

  if (!ACCOUNTING_CODE_PATTERN.test(trimmed)) {
    return refused(
      'ACCOUNTING_CODE_INVALID',
      'کد حسابداری واحد فقط می‌تواند حروف، عدد و جداکنندهٔ متداول داشته باشد',
    );
  }

  return accepted(trimmed);
};

export const validateUnitRecordSelection = ({
  recordId,
  catalog,
}: {
  recordId: string | null;
  catalog: QuotationUnitCatalogRow[];
}): Result<QuotationUnitCatalogRow> => {
  const id = (recordId ?? '').trim();

  if (id === '') {
    return refused(
      'QUOTATION_UNIT_REQUIRED',
      'واحد مرجع را از فهرست رسمی انتخاب کنید',
    );
  }

  const row = catalog.find((entry) => entry.recordId === id);

  if (row === undefined) {
    return refused('QUOTATION_UNIT_NOT_FOUND', 'واحد مرجع در فهرست نیست');
  }

  if (!row.isActive) {
    return refused(
      'QUOTATION_UNIT_INACTIVE',
      'واحد انتخاب‌شده غیرفعال است؛ واحد فعال دیگری انتخاب کنید',
    );
  }

  return accepted(row);
};