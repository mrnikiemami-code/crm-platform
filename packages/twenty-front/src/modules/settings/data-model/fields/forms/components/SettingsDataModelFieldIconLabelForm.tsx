import { css } from '@linaria/core';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { type z } from 'zod';

import { useGetIsMetadataItemCustom } from '@/object-metadata/hooks/useGetIsMetadataItemCustom';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { fieldMetadataItemSchema } from '@/object-metadata/validation-schemas/fieldMetadataItemSchema';
import { AdvancedSettingsContentWrapperWithDot } from '@/settings/components/AdvancedSettingsContentWrapperWithDot';
import { AdvancedSettingsWrapper } from '@/settings/components/AdvancedSettingsWrapper';
import { SettingsOptionCardContentSwitch } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSwitch';
import { IDENTIFIER_MAX_CHAR_LENGTH } from 'twenty-shared/metadata';
import { computeFieldTechnicalNameSuggestion } from '@/settings/data-model/fields/forms/utils/computeFieldTechnicalNameSuggestion';
import { getErrorMessageFromError } from '@/settings/data-model/fields/forms/utils/errorMessages';
import { shouldShowFieldTechnicalNameInput } from '@/settings/data-model/fields/forms/utils/shouldShowFieldTechnicalNameInput';
import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { IconPicker } from '@/ui/input/components/IconPicker';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useLingui } from '@lingui/react/macro';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconRefresh } from 'twenty-ui/icon';
import { InlineBanner } from 'twenty-ui/primitives/feedback';
import { Field } from 'twenty-ui/primitives/input';
import { Card } from 'twenty-ui/primitives/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';

export const settingsDataModelFieldIconLabelFormSchema = (
  existingOtherLabels: string[] = [],
) => {
  return fieldMetadataItemSchema(existingOtherLabels)
    .pick({
      icon: true,
      label: true,
    })
    .merge(
      fieldMetadataItemSchema()
        .pick({
          name: true,
          isLabelSyncedWithName: true,
        })
        .partial(),
    );
};

type SettingsDataModelFieldIconLabelFormValues = z.infer<
  ReturnType<typeof settingsDataModelFieldIconLabelFormSchema>
>;

const StyledInputsContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledAdvancedSettingsOuterContainer = styled.div`
  padding-top: ${themeCssVariables.spacing[4]};
`;

const StyledTechnicalNameContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[4]};
`;

const readonlyTechnicalNameClassName = css`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  height: 32px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  text-align: start;
  user-select: text;
  width: 100%;
`;

type SettingsDataModelFieldIconLabelFormProps = {
  fieldMetadataItem?: FieldMetadataItem;
  maxLength?: number;
  isCreationMode?: boolean;
  readonly?: boolean;
  fieldType?: FieldMetadataType;
  existingFieldNames?: string[];
};

export const SettingsDataModelFieldIconLabelForm = ({
  isCreationMode = false,
  fieldMetadataItem,
  maxLength,
  readonly = false,
  fieldType,
  existingFieldNames = [],
}: SettingsDataModelFieldIconLabelFormProps) => {
  const {
    control,
    setValue,
    watch,
    formState: { errors },
    trigger,
  } = useFormContext<SettingsDataModelFieldIconLabelFormValues>();

  const label = watch('label');

  const { t, i18n } = useLingui();

  const getIsMetadataItemCustom = useGetIsMetadataItemCustom();

  const isCustomField =
    isDefined(fieldMetadataItem) && getIsMetadataItemCustom(fieldMetadataItem);

  const labelTextInputId = `${fieldMetadataItem?.id}-label`;
  const nameTextInputId = `${fieldMetadataItem?.id}-name`;

  const technicalNameLabel = t({
    message: 'API Name',
    context: 'Field technical name',
  });

  const isLabelSyncedWithName =
    watch('isLabelSyncedWithName') ??
    (isDefined(fieldMetadataItem)
      ? fieldMetadataItem.isLabelSyncedWithName
      : true);

  const fillNameFromLabel = (label: string) => {
    isDefined(label) &&
      setValue('name', computeMetadataNameFromLabel(label), {
        shouldDirty: true,
      });
  };

  const [isNameEditedManually, setIsNameEditedManually] = useState(false);

  const getRequiresExplicitName = (nextLabel: string | undefined) =>
    shouldShowFieldTechnicalNameInput({
      isCreationMode,
      label: nextLabel,
      locale: i18n.locale,
    });

  const requiresExplicitName = getRequiresExplicitName(label);

  const setLabelSyncedWithName = (nextIsLabelSyncedWithName: boolean) =>
    setValue('isLabelSyncedWithName', nextIsLabelSyncedWithName, {
      shouldDirty: true,
    });

  const fillNameOnCreation = (nextLabel: string) => {
    if (!getRequiresExplicitName(nextLabel)) {
      setIsNameEditedManually(false);
      setLabelSyncedWithName(true);
      fillNameFromLabel(nextLabel);
      return;
    }

    setLabelSyncedWithName(false);

    if (!isNameEditedManually && isDefined(fieldType)) {
      setValue(
        'name',
        computeFieldTechnicalNameSuggestion({ fieldType, existingFieldNames }),
        { shouldDirty: true, shouldValidate: true },
      );
    }
  };

  // Transliterating a non-Latin label would silently rename the stored name
  const syncNameOnEdition = (nextLabel: string) => {
    if (hasNonLatinLetters(nextLabel)) {
      setLabelSyncedWithName(false);
      return;
    }

    fillNameFromLabel(nextLabel);
  };

  const isRelation =
    fieldMetadataItem?.type === FieldMetadataType.RELATION ||
    fieldMetadataItem?.type === FieldMetadataType.MORPH_RELATION;

  const isCustomButNotRelationField = isCustomField && !isRelation;

  // Default fields of custom objects (createdAt, position...) are custom too,
  // but renaming them would break the records they are built on
  const isSystemField =
    fieldMetadataItem?.isSystem === true ||
    fieldMetadataItem?.isUIEditable === false;

  const isRenamableField = isCustomButNotRelationField && !isSystemField;

  const canToggleSyncLabelWithName = !isCreationMode && isRenamableField;

  const showsStoredTechnicalName = !isCreationMode && isCustomField;

  const canEditStoredTechnicalName =
    showsStoredTechnicalName && isRenamableField && !readonly;

  const isLabelEditEnabled =
    isCreationMode ||
    (!isCreationMode &&
      ((isDefined(fieldMetadataItem) && !isCustomField) ||
        isCustomButNotRelationField));

  return (
    <>
      <StyledInputsContainer>
        <Controller
          name="icon"
          control={control}
          defaultValue={fieldMetadataItem?.icon ?? 'IconUsers'}
          render={({ field: { onChange, value } }) => (
            <IconPicker
              selectedIconKey={value ?? 'IconUsers'}
              onChange={({ iconKey }) => onChange(iconKey)}
              variant="outline"
              disabled={readonly}
            />
          )}
        />
        <Controller
          name="label"
          control={control}
          defaultValue={fieldMetadataItem?.label}
          render={({ field: { onChange, value } }) => (
            <SettingsTextInput
              instanceId={labelTextInputId}
              placeholder={t`Employees`}
              value={value}
              disabled={!isLabelEditEnabled || readonly}
              onChange={(value) => {
                onChange(value);
                trigger('label');
                if (isCreationMode) {
                  fillNameOnCreation(value);
                } else if (isLabelSyncedWithName === true && isRenamableField) {
                  syncNameOnEdition(value);
                }
              }}
              error={getErrorMessageFromError(errors.label?.message)}
              maxLength={maxLength}
              fullWidth
            />
          )}
        />
      </StyledInputsContainer>
      {requiresExplicitName && (
        <StyledTechnicalNameContainer>
          <InlineBanner
            color="blue"
            message={t`The label contains non-Latin characters. Enter the technical name in Latin letters (e.g. eventTitle).`}
          />
          <Controller
            name="name"
            control={control}
            render={({ field: { onChange, value } }) => (
              <SettingsTextInput
                instanceId={`${nameTextInputId}-explicit`}
                label={technicalNameLabel}
                placeholder="eventCode"
                value={value ?? ''}
                dir="ltr"
                required
                onChange={(nextValue) => {
                  onChange(nextValue);
                  setIsNameEditedManually(true);
                  trigger('name');
                }}
                disabled={readonly}
                fullWidth
                maxLength={IDENTIFIER_MAX_CHAR_LENGTH}
                error={errors.name?.message}
              />
            )}
          />
        </StyledTechnicalNameContainer>
      )}
      {canEditStoredTechnicalName && (
        <StyledTechnicalNameContainer>
          <Controller
            name="name"
            control={control}
            defaultValue={fieldMetadataItem?.name}
            render={({ field: { onChange, value } }) => (
              <SettingsTextInput
                instanceId={nameTextInputId}
                label={technicalNameLabel}
                placeholder="eventCode"
                value={value ?? ''}
                dir="ltr"
                required
                onChange={(nextValue) => {
                  onChange(nextValue);
                  if (isLabelSyncedWithName !== false) {
                    setLabelSyncedWithName(false);
                  }
                  trigger('name');
                }}
                fullWidth
                maxLength={IDENTIFIER_MAX_CHAR_LENGTH}
                error={errors.name?.message}
              />
            )}
          />
        </StyledTechnicalNameContainer>
      )}
      {showsStoredTechnicalName &&
        !canEditStoredTechnicalName &&
        isDefined(fieldMetadataItem) && (
          <StyledTechnicalNameContainer>
            <Field.Root>
              <Field.Label>{technicalNameLabel}</Field.Label>
              <Field.Control
                className={readonlyTechnicalNameClassName}
                value={fieldMetadataItem.name}
                dir="ltr"
                readOnly
              />
            </Field.Root>
          </StyledTechnicalNameContainer>
        )}
      {canToggleSyncLabelWithName && (
        <AdvancedSettingsWrapper hideDot>
          <StyledAdvancedSettingsOuterContainer>
            <Controller
              name="isLabelSyncedWithName"
              control={control}
              defaultValue={fieldMetadataItem?.isLabelSyncedWithName ?? true}
              render={({ field: { onChange, value } }) => (
                <AdvancedSettingsContentWrapperWithDot
                  hideDot={false}
                  dotPosition="centered"
                >
                  <Card rounded>
                    <SettingsOptionCardContentSwitch
                      Icon={IconRefresh}
                      title={t`Synchronize Field Label and API Name`}
                      description={t`Should changing a field's label also change the API name?`}
                      checked={value ?? true}
                      disabled={readonly}
                      advancedMode
                      onChange={(value) => {
                        onChange(value);
                        if (!isDefined(fieldMetadataItem) || value === false) {
                          return;
                        }

                        syncNameOnEdition(label);
                      }}
                    />
                  </Card>
                </AdvancedSettingsContentWrapperWithDot>
              )}
            />
          </StyledAdvancedSettingsOuterContainer>
        </AdvancedSettingsWrapper>
      )}
    </>
  );
};
