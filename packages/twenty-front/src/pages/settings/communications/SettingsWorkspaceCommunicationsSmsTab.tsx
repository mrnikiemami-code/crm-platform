import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components';
import { Info, useToast } from 'twenty-ui/primitives/feedback';
import { Button, Radio, RadioGroup } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { TextInput } from '@/ui/input/components/TextInput';
import { UpdateOneApplicationVariableDocument } from '~/generated-metadata/graphql';

// The Communication application is resolved by its STABLE universal
// identifier, never by an install UUID, display name or workspace id, so the
// tab works in any workspace that has the app installed.
const COMMUNICATION_APPLICATION_UNIVERSAL_IDENTIFIER =
  '768bca20-0b81-4d33-a624-0a894a193ffd';

const COMMUNICATION_PROVIDER_VARIABLE_KEY = 'COMMUNICATION_PROVIDER';

const FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS = gql`
  query FindCommunicationAppForSmsSettings($universalIdentifier: UUID!) {
    findOneApplication(universalIdentifier: $universalIdentifier) {
      id
      applicationVariables {
        key
        value
        isSecret
      }
    }
  }
`;

type CommunicationAppVariable = {
  key: string;
  value: string;
  isSecret: boolean;
};

type CommunicationAppForSmsSettingsQuery = {
  findOneApplication: {
    id: string;
    applicationVariables: CommunicationAppVariable[];
  } | null;
};

type CommunicationAppForSmsSettingsVariables = {
  universalIdentifier: string;
};

type SmsProviderField = {
  key: string;
  isSecret: boolean;
  label: string;
  description: string;
};

type SmsProviderConfig = {
  id: string;
  label: string;
  description: string;
  fields: SmsProviderField[];
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledProviderCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledProviderOption = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledFieldDescription = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledFieldRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledStatus = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledLtrTextInput = styled(TextInput)`
  direction: ltr;
`;

type SmsProviderSectionProps = {
  config: SmsProviderConfig;
  values: Record<string, string>;
  secretPresence: Record<string, boolean>;
  isDefault: boolean;
  isSaving: boolean;
  onValueChange: (key: string, value: string) => void;
  onRequestClearSecret: (key: string) => void;
  onSave: () => void;
};

const SmsProviderSection = ({
  config,
  values,
  secretPresence,
  isDefault,
  isSaving,
  onValueChange,
  onRequestClearSecret,
  onSave,
}: SmsProviderSectionProps) => {
  const { t } = useLingui();

  return (
    <StyledProviderCard>
      <Section.Root>
        <Section.Header
          title={config.label}
          description={config.description}
          adornment={
            isDefault ? (
              <StyledStatus>{t`Default provider`}</StyledStatus>
            ) : undefined
          }
        />
      </Section.Root>

      {config.fields.map((field) => {
        const isConfigured = secretPresence[field.key] === true;

        return (
          <StyledField key={field.key}>
            <StyledFieldLabel>{field.label}</StyledFieldLabel>
            <StyledFieldRow>
              <StyledLtrTextInput
                value={values[field.key] ?? ''}
                onChange={(text) => onValueChange(field.key, text)}
                placeholder={
                  field.isSecret
                    ? isConfigured
                      ? t`Configured — leave empty to keep`
                      : t`Not configured`
                    : ''
                }
                type={field.isSecret ? 'password' : 'text'}
                fullWidth
                autoComplete="off"
              />
              {field.isSecret && isConfigured && (
                <Button
                  variant="outline"
                  color="danger"
                  size="sm"
                  onClick={() => onRequestClearSecret(field.key)}
                >
                  {t`Clear`}
                </Button>
              )}
            </StyledFieldRow>
            <StyledFieldDescription>{field.description}</StyledFieldDescription>
            {field.isSecret && (
              <StyledStatus>
                {isConfigured
                  ? t`A value is configured. Enter a new value to replace it, or leave it empty to keep it.`
                  : t`No value is configured.`}
              </StyledStatus>
            )}
          </StyledField>
        );
      })}

      <StyledActions>
        <Button
          variant="solid"
          color="accent"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          loading={isSaving}
        >
          {t`Save`}
        </Button>
      </StyledActions>
    </StyledProviderCard>
  );
};

export const SettingsWorkspaceCommunicationsSmsTab = () => {
  const { t } = useLingui();
  const { enqueueToast } = useToast();

  const { data, loading, refetch } = useQuery<
    CommunicationAppForSmsSettingsQuery,
    CommunicationAppForSmsSettingsVariables
  >(FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS, {
    variables: {
      universalIdentifier: COMMUNICATION_APPLICATION_UNIVERSAL_IDENTIFIER,
    },
  });

  const [updateOneApplicationVariable] = useMutation(
    UpdateOneApplicationVariableDocument,
  );

  const [draftValueByKey, setDraftValueByKey] = useState<
    Record<string, string>
  >({});
  // A secret is cleared only through the explicit Clear action: an empty
  // secret input means "keep the existing value", so "empty" and "clear" must
  // be tracked as two different intents.
  const [secretKeysToClear, setSecretKeysToClear] = useState<
    Record<string, boolean>
  >({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);

  const application = data?.findOneApplication ?? null;

  if (loading) {
    return (
      <Section.Root>
        <StyledStatus>{t`Loading…`}</StyledStatus>
      </Section.Root>
    );
  }

  if (!isDefined(application)) {
    return (
      <Section.Root>
        <Info
          text={t`The Communication module is not installed in this workspace.`}
        />
      </Section.Root>
    );
  }

  const storedValueByKey: Record<string, string> = Object.fromEntries(
    application.applicationVariables.map((variable) => [
      variable.key,
      variable.value,
    ]),
  );

  // Presence only: a secret value is never read into the form, only whether it
  // is set. The server masks secrets, so this is a display-state signal.
  const secretPresenceByKey: Record<string, boolean> = Object.fromEntries(
    application.applicationVariables
      .filter((variable) => variable.isSecret)
      .map((variable) => [variable.key, isNonEmptyString(variable.value)]),
  );

  const readValue = (key: string): string =>
    draftValueByKey[key] ??
    (secretPresenceByKey[key] ? '' : (storedValueByKey[key] ?? ''));

  const selectedProviderId =
    storedValueByKey[COMMUNICATION_PROVIDER_VARIABLE_KEY] ?? '';

  const persistVariable = async (key: string, value: string) => {
    const result = await updateOneApplicationVariable({
      variables: { key, value, applicationId: application.id },
    });

    if (result.data?.updateOneApplicationVariable !== true) {
      throw new Error(`Failed to save ${key}`);
    }
  };

  const handleSelectDefaultProvider = async (providerId: string) => {
    try {
      await persistVariable(COMMUNICATION_PROVIDER_VARIABLE_KEY, providerId);
      await refetch();
      enqueueToast({
        variant: 'success',
        children: t`Default provider saved.`,
      });
    } catch {
      enqueueToast({
        variant: 'error',
        children: t`Failed to save the default provider.`,
      });
    }
  };

  const handleSaveProvider = async (config: SmsProviderConfig) => {
    setSavingProviderId(config.id);

    const pendingWrites: { key: string; value: string }[] = [];

    for (const field of config.fields) {
      const draftValue = draftValueByKey[field.key];

      if (field.isSecret) {
        if (secretKeysToClear[field.key] === true) {
          pendingWrites.push({ key: field.key, value: '' });
        } else if (isNonEmptyString(draftValue)) {
          pendingWrites.push({ key: field.key, value: draftValue });
        }
        continue;
      }

      if (isDefined(draftValue) && draftValue !== storedValueByKey[field.key]) {
        pendingWrites.push({ key: field.key, value: draftValue });
      }
    }

    try {
      for (const write of pendingWrites) {
        await persistVariable(write.key, write.value);
      }

      await refetch();

      setDraftValueByKey((previous) => {
        const next = { ...previous };
        for (const field of config.fields) {
          delete next[field.key];
        }
        return next;
      });
      setSecretKeysToClear((previous) => {
        const next = { ...previous };
        for (const field of config.fields) {
          delete next[field.key];
        }
        return next;
      });

      enqueueToast({
        variant: 'success',
        children: t`Settings saved.`,
      });
    } catch {
      // A partial write must not read as a full success: the drafts are kept so
      // the user can retry, and the failure is stated plainly.
      enqueueToast({
        variant: 'error',
        children: t`Some settings could not be saved. Nothing else was changed.`,
      });
    } finally {
      setSavingProviderId(null);
    }
  };

  // Only providers this app actually implements. RazPayamak's REST base is a
  // fixed constant in the app, so it is intentionally NOT a field here. The
  // copy is built with tagged templates so lingui extracts it for translation.
  const providerConfigs: SmsProviderConfig[] = [
    {
      id: 'kavenegar',
      label: 'Kavenegar',
      description: t`Send SMS through the Kavenegar service.`,
      fields: [
        {
          key: 'KAVENEGAR_API_KEY',
          isSecret: true,
          label: t`API key`,
          description: t`Kavenegar API key. Stored encrypted per workspace and never shown again.`,
        },
        {
          key: 'KAVENEGAR_ENDPOINT',
          isSecret: false,
          label: t`API endpoint`,
          description: t`Kavenegar API base endpoint, for example https://api.kavenegar.com/v1.`,
        },
        {
          key: 'KAVENEGAR_SENDER',
          isSecret: false,
          label: t`Sender line`,
          description: t`Kavenegar sender line the message is sent from.`,
        },
      ],
    },
    {
      id: 'razpayamak',
      label: 'RazPayamak',
      description: t`Send SMS through the RazPayamak SmartSMS service.`,
      fields: [
        {
          key: 'RAZPAYAMAK_USERNAME',
          isSecret: false,
          label: t`Panel username`,
          description: t`RazPayamak panel username used by the SmartSMS service.`,
        },
        {
          key: 'RAZPAYAMAK_API_KEY',
          isSecret: true,
          label: t`API key`,
          description: t`RazPayamak API key issued under the developer menu. Stored encrypted per workspace and never shown again.`,
        },
        {
          key: 'RAZPAYAMAK_SENDER',
          isSecret: false,
          label: t`Primary sender`,
          description: t`RazPayamak primary sender number.`,
        },
        {
          key: 'RAZPAYAMAK_BACKUP_SENDER_ONE',
          isSecret: false,
          label: t`Backup sender one`,
          description: t`Optional backup sender used when the primary line fails.`,
        },
        {
          key: 'RAZPAYAMAK_BACKUP_SENDER_TWO',
          isSecret: false,
          label: t`Backup sender two`,
          description: t`Optional second backup sender.`,
        },
      ],
    },
  ];

  return (
    <StyledContainer>
      <Section.Root>
        <Section.Header
          title={t`SMS provider`}
          description={t`Choose the default SMS provider. Each provider keeps its own settings; selecting a default does not erase the other provider's settings.`}
        />
        <RadioGroup
          aria-label={t`Default SMS provider`}
          value={selectedProviderId}
          onValueChange={(value) => {
            void handleSelectDefaultProvider(String(value));
          }}
        >
          {providerConfigs.map((config) => (
            <StyledProviderOption key={config.id}>
              <Radio value={config.id} />
              <StyledFieldLabel>{config.label}</StyledFieldLabel>
            </StyledProviderOption>
          ))}
        </RadioGroup>
        <StyledStatus>
          {t`Only the selected provider is used when sending.`}
        </StyledStatus>
      </Section.Root>

      {providerConfigs.map((config) => (
        <SmsProviderSection
          key={config.id}
          config={config}
          values={Object.fromEntries(
            config.fields.map((field) => [field.key, readValue(field.key)]),
          )}
          secretPresence={Object.fromEntries(
            config.fields
              .filter((field) => field.isSecret)
              .map((field) => [
                field.key,
                secretPresenceByKey[field.key] === true &&
                  secretKeysToClear[field.key] !== true,
              ]),
          )}
          isDefault={selectedProviderId === config.id}
          isSaving={savingProviderId === config.id}
          onValueChange={(key, value) =>
            setDraftValueByKey((previous) => ({ ...previous, [key]: value }))
          }
          onRequestClearSecret={(key) =>
            setSecretKeysToClear((previous) => ({ ...previous, [key]: true }))
          }
          onSave={() => {
            void handleSaveProvider(config);
          }}
        />
      ))}

      <StyledStatus>
        {t`Saved values are stored per workspace. Secrets are never displayed again once saved. No connection is verified here.`}
      </StyledStatus>
      <StyledStatus>
        {t`Only the variables of the selected provider need to be filled in.`}
      </StyledStatus>
    </StyledContainer>
  );
};
