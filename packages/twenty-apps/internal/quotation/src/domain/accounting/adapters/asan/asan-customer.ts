import { accepted, refused, type Result } from 'src/domain/shared/result';

// Maps a CRM person or company onto Asan's `CustomerViewModel`.
//
// `PersonCode = 0` makes Asan assign the code itself (largest group code + 1, above 101). The
// documented create response is a RESULT FLAG, not the assigned code, so a caller that wants
// to store the code must re-read the customer — which is why the party capability declares
// `returnsAssignedCode: false`.
export const ASAN_ASSIGN_CODE_SENTINEL = 0;

// Asan refuses to UPDATE with PersonCode = 0 (-10), so the sentinel is only ever valid on a
// create. Encoding both facts as constants keeps a create-only value from leaking into an
// update path.
export const ASAN_MIN_MANUAL_PERSON_CODE = 101;

export type AsanCustomerInput = {
  PersonCode: number;
  PersonFullName: string;
  // Asan types this as a byte and describes it as the account nature, not a title; 0 is the
  // documented default and must not be invented from a name.
  PersonGender: number;
  PersonMobile?: string;
  PersonNationalCode?: string;
  PersonAddress?: string;
  PersonFirstTell?: string;
  PersonSecoundTell?: string;
  PersonFax?: string;
  PersonEcoCode?: string;
  PersonPostalCode?: string;
  PersonAccountGroup?: string;
  UserID: number;
};

export const ASAN_DEFAULT_PERSON_GENDER = 0;

export type PartyMappingInput = {
  // Null means "let Asan assign it" and is only legal on a create.
  personCode: number | null;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  address: string | null;
  economicCode: string | null;
  postalCode: string | null;
  firstPhone: string | null;
  secondPhone: string | null;
  fax: string | null;
  accountGroup: string | null;
  userId: number;
  personGender?: number;
};

const MAX_FULL_NAME_LENGTH = 200;

// Asan stores phone numbers as text and passes them through as typed, so the CRM does not
// reformat them — a normalisation that drops a leading zero would send the customer a document
// with a number nobody answers. An absent or blank value is omitted rather than sent as an
// empty string, so an update cannot erase a field the CRM simply does not know.
const withField = <TKey extends string>(
  key: TKey,
  value: string | null,
): Partial<Record<TKey, string>> =>
  value === null || value.trim() === ''
    ? {}
    : ({ [key]: value.trim() } as Partial<Record<TKey, string>>);

export const mapPartyToAsanCustomer = (
  input: PartyMappingInput,
  { isUpdate }: { isUpdate: boolean },
): Result<AsanCustomerInput> => {
  const fullName = input.fullName.trim();

  if (fullName === '') {
    return refused(
      'ASAN_CUSTOMER_NAME_MISSING',
      'Asan requires a customer name',
    );
  }

  if (fullName.length > MAX_FULL_NAME_LENGTH) {
    return refused(
      'ASAN_CUSTOMER_NAME_TOO_LONG',
      `Asan's customer name field is limited; this name is ${fullName.length} characters`,
    );
  }

  if (!Number.isInteger(input.userId) || input.userId <= 0 || input.userId > 2147483647) return refused('ASAN_USER_ID_INVALID', 'a valid Asan user id is required');
  const gender = input.personGender ?? ASAN_DEFAULT_PERSON_GENDER;
  if (!Number.isInteger(gender) || gender < 0 || gender > 255) return refused('ASAN_ACCOUNT_NATURE_INVALID', 'account nature must be a byte');
  let personCode: number;

  if (isUpdate) {
    // -10 is what Asan answers to an update carrying 0, so the refusal happens here with a
    // readable reason instead of as a numeric code from the vendor.
    if (input.personCode === null || input.personCode < ASAN_MIN_MANUAL_PERSON_CODE) {
      return refused(
        'ASAN_UPDATE_NEEDS_PERSON_CODE',
        `an update needs an existing Asan person code of at least ${ASAN_MIN_MANUAL_PERSON_CODE}`,
      );
    }

    personCode = input.personCode;
  } else {
    personCode = input.personCode ?? ASAN_ASSIGN_CODE_SENTINEL;

    if (
      personCode !== ASAN_ASSIGN_CODE_SENTINEL &&
      personCode < ASAN_MIN_MANUAL_PERSON_CODE
    ) {
      return refused(
        'ASAN_PERSON_CODE_TOO_SMALL',
        `Asan reserves codes below ${ASAN_MIN_MANUAL_PERSON_CODE}; send 0 to let it assign one`,
      );
    }
  }

  if (!Number.isInteger(personCode) || personCode < 0 || personCode > 2147483647) return refused('ASAN_PERSON_CODE_INVALID', 'person code is outside the int range');
  return accepted({
    PersonCode: personCode,
    PersonFullName: fullName,
    PersonGender: gender,
    ...withField('PersonMobile', input.mobile),
    ...withField('PersonNationalCode', input.nationalCode),
    ...withField('PersonAddress', input.address),
    ...withField('PersonEcoCode', input.economicCode),
    ...withField('PersonPostalCode', input.postalCode),
    ...withField('PersonFirstTell', input.firstPhone),
    ...withField('PersonSecoundTell', input.secondPhone),
    ...withField('PersonFax', input.fax),
    ...withField('PersonAccountGroup', input.accountGroup),
    UserID: input.userId,
  });
};

// A CRM person and a CRM company are both Asan customers, and the guide documents no separate
// company entity. The distinction must therefore survive in the CRM, not be implied by the
// Asan record.
export const ASAN_HAS_NO_COMPANY_ENTITY = true;
