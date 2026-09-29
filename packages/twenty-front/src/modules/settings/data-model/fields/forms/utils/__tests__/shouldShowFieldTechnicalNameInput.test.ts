import { shouldShowFieldTechnicalNameInput } from '@/settings/data-model/fields/forms/utils/shouldShowFieldTechnicalNameInput';

describe('shouldShowFieldTechnicalNameInput', () => {
  it('should show the input in fa-IR before a label is typed', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: '',
        locale: 'fa-IR',
      }),
    ).toBe(true);
  });

  it('should show the input for a Persian label in fa-IR', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: 'کد همایش',
        locale: 'fa-IR',
      }),
    ).toBe(true);
  });

  it('should keep label sync for a Latin label in fa-IR', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: 'Event code',
        locale: 'fa-IR',
      }),
    ).toBe(false);
  });

  it('should hide the input for an empty or Latin label in en', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: '',
        locale: 'en',
      }),
    ).toBe(false);
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: 'Event code',
        locale: 'en',
      }),
    ).toBe(false);
  });

  it('should show the input for a non-Latin label in en', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: true,
        label: 'کد همایش',
        locale: 'en',
      }),
    ).toBe(true);
  });

  it('should never show the input when editing an existing field', () => {
    expect(
      shouldShowFieldTechnicalNameInput({
        isCreationMode: false,
        label: 'کد همایش',
        locale: 'fa-IR',
      }),
    ).toBe(false);
  });
});
