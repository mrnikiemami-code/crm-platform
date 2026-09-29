import { getObjectColorWithFallback } from '@/object-metadata/utils/getObjectColorWithFallback';
import { useGetIsMetadataItemCustom } from '@/object-metadata/hooks/useGetIsMetadataItemCustom';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { AdvancedSettingsWrapper } from '@/settings/components/AdvancedSettingsWrapper';
import { SettingsOptionCardContentSwitch } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSwitch';
import { OBJECT_NAME_MAXIMUM_LENGTH } from '@/settings/data-model/constants/ObjectNameMaximumLength';
import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { type SettingsDataModelObjectAboutFormValues } from '@/settings/data-model/validation-schemas/settingsDataModelObjectAboutFormSchema';
import { IconPicker } from '@/ui/input/components/IconPicker';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import { TooltipDelay } from '@/ui/layout/tooltip/constants/TooltipDelay';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { plural } from 'pluralize';
import { Fragment, useContext, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { SettingsPath } from 'twenty-shared/types';
import { capitalize, isDefined } from 'twenty-shared/utils';
import { InlineBanner } from 'twenty-ui/primitives/feedback';
import { IconInfoCircle, IconLink, IconRefresh } from 'twenty-ui/icon';
import { Tooltip, Card } from 'twenty-ui/primitives/surfaces';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { type StringKeyOf } from 'type-fest';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { computeMetadataNamesFromLabels } from '~/pages/settings/data-model/utils/computeMetadataNamesFromLabels';

type SettingsDataModelObjectAboutFormProps = {
  disableEdition?: boolean;
  objectMetadataItem?: EnrichedObjectMetadataItem;
  onNewDirtyField?: () => void;
  conflictingObjectMetadataItem?: EnrichedObjectMetadataItem;
};

const StyledInputsContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledAdvancedSettingsSectionInputWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledAdvancedSettingsOuterContainer = styled.div`
  padding-top: ${themeCssVariables.spacing[4]};
`;

const StyledAdvancedSettingsContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  position: relative;
  width: 100%;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledTechnicalNameError = styled.span`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const infoCircleElementId = 'info-circle-id';

export const SettingsDataModelObjectAboutForm = ({
  disableEdition = false,
  onNewDirtyField,
  objectMetadataItem,
  conflictingObjectMetadataItem,
}: SettingsDataModelObjectAboutFormProps) => {
  const { theme } = useContext(ThemeContext);
  const { control, watch, setValue } =
    useFormContext<SettingsDataModelObjectAboutFormValues>();
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const getIsMetadataItemCustom = useGetIsMetadataItemCustom();

  const isLabelSyncedWithName = watch('isLabelSyncedWithName');
  const labelSingular = watch('labelSingular');
  const labelPlural = watch('labelPlural');
  const isStandardObject =
    isDefined(objectMetadataItem) &&
    !getIsMetadataItemCustom(objectMetadataItem);
  const showObjectColorInIconPicker =
    !isStandardObject &&
    (!isDefined(objectMetadataItem) ||
      getIsMetadataItemCustom(objectMetadataItem));
  watch('description');
  watch('icon');
  const objectIconColor = watch('color');
  const resolvedIconColor = getObjectColorWithFallback({
    nameSingular: objectMetadataItem?.nameSingular ?? watch('nameSingular'),
    isSystem: objectMetadataItem?.isSystem ?? false,
    color: objectIconColor,
  });

  const apiNameTooltipText =
    !isDefined(objectMetadataItem) ||
    getIsMetadataItemCustom(objectMetadataItem)
      ? isLabelSyncedWithName
        ? t`Deactivate "Synchronize Objects Labels and API Names" to set a custom API name`
        : t`Input must be in camel case and cannot start with a number`
      : t`Can't change API names for standard objects`;

  const isObjectBeingCreated = !isDefined(objectMetadataItem);

  // Transliterating non-Latin labels yields ambiguous names (e.g. "hmyshH"),
  // so new objects with such labels need an explicit technical name.
  const doLabelsRequireExplicitTechnicalName = (
    currentLabelSingular: string | undefined,
    currentLabelPlural: string | undefined,
  ) =>
    isObjectBeingCreated &&
    (hasNonLatinLetters(currentLabelSingular) ||
      hasNonLatinLetters(currentLabelPlural));

  const requiresExplicitTechnicalName = doLabelsRequireExplicitTechnicalName(
    labelSingular,
    labelPlural,
  );

  const [isNamePluralEditedManually, setIsNamePluralEditedManually] =
    useState(false);

  const fillLabelPlural = (labelSingular: string | undefined) => {
    if (!isDefined(labelSingular)) return;

    const labelPluralFromSingularLabel = plural(labelSingular);
    setValue('labelPlural', labelPluralFromSingularLabel, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (isLabelSyncedWithName) {
      fillNamesFromLabels(labelSingular, labelPluralFromSingularLabel);
    }
  };

  const fillNamesFromLabels = (
    currentLabelSingular: string,
    currentLabelPlural: string,
  ) => {
    if (
      doLabelsRequireExplicitTechnicalName(
        currentLabelSingular,
        currentLabelPlural,
      )
    ) {
      if (isLabelSyncedWithName) {
        setValue('isLabelSyncedWithName', false, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    const { nameSingular, namePlural } = computeMetadataNamesFromLabels(
      currentLabelSingular,
      currentLabelPlural,
    );

    setValue('nameSingular', nameSingular, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('namePlural', namePlural, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const descriptionTextAreaId = `${objectMetadataItem?.id}-description`;
  const labelSingularTextInputId = `${objectMetadataItem?.id}-label-singular`;
  const labelPluralTextInputId = `${objectMetadataItem?.id}-label-plural`;

  return (
    <>
      <StyledInputsContainer>
        <StyledInputContainer>
          <StyledLabel>{t`Icon`}</StyledLabel>
          <Controller
            name="icon"
            control={control}
            defaultValue={objectMetadataItem?.icon ?? 'IconListNumbers'}
            render={({ field: { onChange, value } }) => (
              <IconPicker
                selectedIconKey={value}
                iconColor={resolvedIconColor}
                disabled={disableEdition}
                dropdownId={
                  isDefined(objectMetadataItem)
                    ? `settings-object-about-icon-${objectMetadataItem.id}`
                    : 'settings-new-object-about-icon'
                }
                iconColorPicker={
                  showObjectColorInIconPicker
                    ? {
                        selectedColor: resolvedIconColor,
                        onColorChange: (nextColor) => {
                          setValue('color', nextColor, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          onNewDirtyField?.();
                        },
                      }
                    : undefined
                }
                onChange={({ iconKey }) => {
                  if (disableEdition) {
                    return;
                  }
                  onChange(iconKey);
                  onNewDirtyField?.();
                }}
              />
            )}
          />
        </StyledInputContainer>
        <Controller
          key={`object-labelSingular-text-input`}
          name="labelSingular"
          control={control}
          defaultValue={objectMetadataItem?.labelSingular ?? ''}
          render={({ field: { onChange, value }, formState: { errors } }) => (
            <SettingsTextInput
              instanceId={labelSingularTextInputId}
              // TODO we should discuss on how to notify user about form validation schema issue, from now just displaying red borders
              noErrorHelper={true}
              error={errors.labelSingular?.message}
              label={t`Singular`}
              placeholder={t`Listing`}
              value={value}
              onChange={(value) => {
                onChange(capitalize(value));
                fillLabelPlural(capitalize(value));
              }}
              onBlur={() => onNewDirtyField?.()}
              disabled={disableEdition}
              fullWidth
              maxLength={OBJECT_NAME_MAXIMUM_LENGTH}
            />
          )}
        />
        <Controller
          key={`object-labelPlural-text-input`}
          name="labelPlural"
          control={control}
          defaultValue={objectMetadataItem?.labelPlural ?? ''}
          render={({ field: { onChange, value }, formState: { errors } }) => (
            <SettingsTextInput
              instanceId={labelPluralTextInputId}
              // TODO we should discuss on how to notify user about form validation schema issue, from now just displaying red borders
              noErrorHelper={true}
              error={errors.labelPlural?.message}
              label={t`Plural`}
              placeholder={t`Listings`}
              value={value}
              onChange={(value) => {
                onChange(capitalize(value));
                if (isLabelSyncedWithName === true) {
                  fillNamesFromLabels(labelSingular, capitalize(value));
                }
              }}
              onBlur={() => onNewDirtyField?.()}
              disabled={disableEdition}
              fullWidth
              maxLength={OBJECT_NAME_MAXIMUM_LENGTH}
            />
          )}
        />
      </StyledInputsContainer>
      <Controller
        name="description"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextArea
            textAreaId={descriptionTextAreaId}
            placeholder={t`Write a description`}
            minRows={4}
            maxRows={5}
            value={value ?? undefined}
            onChange={(nextValue) => onChange(nextValue ?? null)}
            onBlur={() => onNewDirtyField?.()}
            disabled={disableEdition}
          />
        )}
      />
      <StyledAdvancedSettingsOuterContainer>
        <StyledAdvancedSettingsContainer>
          <StyledAdvancedSettingsSectionInputWrapper>
            {isDefined(conflictingObjectMetadataItem) && (
              <InlineBanner
                color={'blue'}
                message={t`An object with this name already exists`}
                button={{
                  title: t`Open`,
                  onClick: () =>
                    navigateSettings(SettingsPath.ObjectDetail, {
                      objectNamePlural:
                        conflictingObjectMetadataItem.namePlural,
                    }),
                }}
              />
            )}
            {requiresExplicitTechnicalName && (
              <InlineBanner
                color={'blue'}
                message={t`The labels contain non-Latin characters. Enter the technical name in Latin letters (e.g. academyEvent).`}
              />
            )}
            {[
              {
                label: t`API Name (Singular)`,
                fieldName:
                  'nameSingular' as const satisfies StringKeyOf<EnrichedObjectMetadataItem>,
                placeholder: `listing`,
                defaultValue: objectMetadataItem?.nameSingular ?? '',
                disableEdition:
                  isStandardObject ||
                  disableEdition ||
                  (isLabelSyncedWithName && !requiresExplicitTechnicalName),
                tooltip: apiNameTooltipText,
              },
              {
                label: t`API Name (Plural)`,
                fieldName:
                  'namePlural' as const satisfies StringKeyOf<EnrichedObjectMetadataItem>,
                placeholder: `listings`,
                defaultValue: objectMetadataItem?.namePlural ?? '',
                disableEdition:
                  isStandardObject ||
                  disableEdition ||
                  (isLabelSyncedWithName && !requiresExplicitTechnicalName),
                tooltip: apiNameTooltipText,
              },
            ].map(
              ({
                fieldName,
                label,
                placeholder,
                disableEdition,
                tooltip,
                defaultValue,
              }) => {
                const technicalNameInput = (
                  <StyledInputContainer>
                    <Controller
                      name={fieldName}
                      control={control}
                      defaultValue={defaultValue}
                      render={({
                        field: { onChange, value },
                        formState: { errors },
                      }) => {
                        const isConflicting =
                          isNonEmptyString(value) &&
                          conflictingObjectMetadataItem?.[fieldName] === value;
                        const errorMessage =
                          errors[fieldName]?.message ??
                          (isConflicting
                            ? t`This technical name is already used by another object`
                            : undefined);

                        return (
                          <>
                            <SettingsTextInput
                              instanceId={`${objectMetadataItem?.id}-${fieldName}`}
                              label={label}
                              placeholder={placeholder}
                              value={value}
                              dir="ltr"
                              required={requiresExplicitTechnicalName}
                              onChange={(nextValue) => {
                                onChange(nextValue);
                                if (!requiresExplicitTechnicalName) {
                                  return;
                                }
                                if (fieldName === 'namePlural') {
                                  setIsNamePluralEditedManually(true);
                                } else if (!isNamePluralEditedManually) {
                                  setValue(
                                    'namePlural',
                                    isNonEmptyString(nextValue)
                                      ? plural(nextValue)
                                      : '',
                                    { shouldDirty: true, shouldValidate: true },
                                  );
                                }
                              }}
                              disabled={disableEdition}
                              fullWidth
                              maxLength={OBJECT_NAME_MAXIMUM_LENGTH}
                              onBlur={() => onNewDirtyField?.()}
                              error={errorMessage}
                              noErrorHelper
                              RightIcon={() =>
                                tooltip && (
                                  <>
                                    <Tooltip
                                      content={tooltip}
                                      sideOffset={5}
                                      side="bottom"
                                      positionMethod="fixed"
                                      delay={TooltipDelay.shortDelay}
                                    >
                                      <IconInfoCircle
                                        id={infoCircleElementId + fieldName}
                                        size={theme.icon.size.md}
                                        color={theme.font.color.tertiary}
                                        style={{ outline: 'none' }}
                                      />
                                    </Tooltip>
                                  </>
                                )
                              }
                            />
                            {isNonEmptyString(errorMessage) && (
                              <StyledTechnicalNameError aria-live="polite">
                                {errorMessage}
                              </StyledTechnicalNameError>
                            )}
                          </>
                        );
                      }}
                    />
                  </StyledInputContainer>
                );

                return requiresExplicitTechnicalName ? (
                  <Fragment key={`object-${fieldName}-text-input`}>
                    {technicalNameInput}
                  </Fragment>
                ) : (
                  <AdvancedSettingsWrapper
                    key={`object-${fieldName}-text-input`}
                    dotPosition="top"
                  >
                    {technicalNameInput}
                  </AdvancedSettingsWrapper>
                );
              },
            )}
            {!isStandardObject && !requiresExplicitTechnicalName && (
              <AdvancedSettingsWrapper>
                <Controller
                  name="isLabelSyncedWithName"
                  control={control}
                  defaultValue={objectMetadataItem?.isLabelSyncedWithName}
                  render={({ field: { onChange, value } }) => (
                    <Card rounded>
                      <SettingsOptionCardContentSwitch
                        Icon={IconRefresh}
                        title={t`Synchronize Objects Labels and API Names`}
                        description={t`Should changing an object's label also change the API?`}
                        checked={value ?? true}
                        advancedMode
                        disabled={disableEdition}
                        onChange={(value) => {
                          onChange(value);
                          const isCustomObject =
                            isDefined(objectMetadataItem) &&
                            getIsMetadataItemCustom(objectMetadataItem);
                          const isbeingCreatedObject =
                            !isDefined(objectMetadataItem);
                          if (
                            value === true &&
                            (isCustomObject || isbeingCreatedObject)
                          ) {
                            fillNamesFromLabels(labelSingular, labelPlural);
                          }
                          onNewDirtyField?.();
                        }}
                      />
                    </Card>
                  )}
                />
              </AdvancedSettingsWrapper>
            )}
            {!isDefined(objectMetadataItem) && (
              <AdvancedSettingsWrapper>
                <Controller
                  name="skipNameField"
                  control={control}
                  defaultValue={false}
                  render={({ field: { onChange, value } }) => (
                    <Card rounded>
                      <SettingsOptionCardContentSwitch
                        Icon={IconLink}
                        title={t`Skip creating a Name field `}
                        description={t`Useful for pivot/junction tables`}
                        checked={value ?? false}
                        advancedMode
                        disabled={disableEdition}
                        onChange={(value) => {
                          onChange(value);
                          onNewDirtyField?.();
                        }}
                      />
                    </Card>
                  )}
                />
              </AdvancedSettingsWrapper>
            )}
          </StyledAdvancedSettingsSectionInputWrapper>
        </StyledAdvancedSettingsContainer>
      </StyledAdvancedSettingsOuterContainer>
    </>
  );
};
