import { settingsFieldFormSchema } from '@/settings/data-model/fields/forms/validation-schemas/settingsFieldFormSchema';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const parseNewTextField = ({ label, name }: { label: string; name: string }) =>
  settingsFieldFormSchema({
    existingOtherLabels: ['eventCode'],
    isCreationMode: true,
  }).safeParse({
    type: FieldMetadataType.TEXT,
    icon: 'IconTypography',
    label,
    name,
    settings: { displayedMaxRows: 0 },
  });

const getNameErrors = (result: ReturnType<typeof parseNewTextField>) =>
  result.error?.issues
    .filter((issue) => issue.path[0] === 'name')
    .map((issue) => issue.message);

describe('settingsFieldFormSchema on creation', () => {
  it('accepts a valid technical name for a non-Latin label', () => {
    expect(
      parseNewTextField({ label: 'کد همایش', name: 'eventTitle' }).success,
    ).toBe(true);
  });

  it.each([
    ['', 'Technical name is required'],
    ['1event', 'Technical name must start with a Latin letter'],
    [
      'Event code',
      'Use only Latin letters and digits in camelCase, starting with a lowercase letter (e.g. eventTitle)',
    ],
    ['eventCode', 'This technical name is already used by another field'],
  ])(
    'reports only the technical name error for %p',
    (name, expectedMessage) => {
      expect(
        getNameErrors(parseNewTextField({ label: 'کد همایش', name })),
      ).toEqual([expectedMessage]);
    },
  );

  it('keeps the camel case rule for names derived from Latin labels', () => {
    expect(
      parseNewTextField({ label: 'Event title', name: 'eventTitle' }).success,
    ).toBe(true);
    expect(
      getNameErrors(parseNewTextField({ label: 'Event title', name: 'Event' })),
    ).toEqual(['String should be camel case']);
  });
});

const parseEditedTextField = (name: string | undefined) =>
  settingsFieldFormSchema({
    initialName: 'hmysh_legacy',
    otherFieldNames: ['eventCode'],
  }).safeParse({
    type: FieldMetadataType.TEXT,
    icon: 'IconTypography',
    label: 'همایش',
    name,
    settings: { displayedMaxRows: 0 },
  });

describe('settingsFieldFormSchema on edition', () => {
  it('accepts the stored name as is, even when it predates the rules', () => {
    expect(parseEditedTextField('hmysh_legacy').success).toBe(true);
    expect(parseEditedTextField(undefined).success).toBe(true);
  });

  it.each([
    ['', 'Technical name is required'],
    ['1event', 'Technical name must start with a Latin letter'],
    ['eventCode', 'This technical name is already used by another field'],
    ['appToken', 'This technical name is reserved, choose another one'],
  ])('validates an edited name %p like on creation', (name, expected) => {
    expect(getNameErrors(parseEditedTextField(name))).toEqual([expected]);
  });
});
