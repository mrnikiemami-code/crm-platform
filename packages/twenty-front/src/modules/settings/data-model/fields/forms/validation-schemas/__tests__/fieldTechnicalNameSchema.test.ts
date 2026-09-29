import { fieldTechnicalNameSchema } from '@/settings/data-model/fields/forms/validation-schemas/fieldTechnicalNameSchema';

const getFirstErrorMessage = (
  value: string,
  existingFieldNames: string[] = [],
) =>
  fieldTechnicalNameSchema(existingFieldNames).safeParse(value).error?.issues[0]
    ?.message;

describe('fieldTechnicalNameSchema', () => {
  it('should accept a lowerCamelCase Latin name', () => {
    expect(fieldTechnicalNameSchema().safeParse('eventTitle').success).toBe(
      true,
    );
    expect(fieldTechnicalNameSchema().safeParse('field2').success).toBe(true);
  });

  it('should reject an empty name', () => {
    expect(getFirstErrorMessage('')).toBe('Technical name is required');
  });

  it.each(['عنوان', '2event', '_event'])(
    'should reject %s as not starting with a Latin letter',
    (value) => {
      expect(getFirstErrorMessage(value)).toBe(
        'Technical name must start with a Latin letter',
      );
    },
  );

  it.each(['EventTitle', 'event_title', 'event title', 'eventعنوان'])(
    'should reject %s',
    (value) => {
      expect(getFirstErrorMessage(value)).toBe(
        'Use only Latin letters and digits in camelCase, starting with a lowercase letter (e.g. eventTitle)',
      );
    },
  );

  it('should reject a reserved name', () => {
    expect(getFirstErrorMessage('appToken')).toBe(
      'This technical name is reserved, choose another one',
    );
  });

  it('should reject a name used by another field', () => {
    expect(getFirstErrorMessage('eventTitle', ['eventTitle'])).toBe(
      'This technical name is already used by another field',
    );
  });
});
