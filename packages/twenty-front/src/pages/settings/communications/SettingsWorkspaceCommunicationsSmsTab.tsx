import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components';
import { Info, useToast } from 'twenty-ui/primitives/feedback';
import { Button, Radio, RadioGroup } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { TextInput } from '@/ui/input/components/TextInput';
import { UpdateOneApplicationVariableDocument } from '~/generated-metadata/graphql';
import {
  applySecretDraftChange,
  type CommunicationSmsLoadState,
  dropUnchangedSucceededDrafts,
  requestSecretClear,
  type SaveOutcome,
  type SecretFieldState,
  resolveCommunicationSmsLoadState,
  resolveSecretInputValue,
  resolveSecretIntent,
  resolveSecretWriteValue,
  summarizeSaveOutcome,
} from '~/pages/settings/communications/utils/communicationSmsSettingsState';

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

const StyledWarningStatus = styled.span`
  color: ${themeCssVariables.color.orange};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledLtrTextInput = styled(TextInput)`
  direction: ltr;
`;

type SmsProviderSectionProps = {
  config: SmsProviderConfig;
  values: Record<string, string>;
  secretPresence: Record<string, boolean>;
  secretClearRequested: Record<string, boolean>;
  isDefault: boolean;
  isSaving: boolean;
  isAnySaveInFlight: boolean;
  onValueChange: (key: string, value: string) => void;
  onRequestClearSecret: (key: string) => void;
  onCancelClearSecret: (key: string) => void;
  onSave: () => void;
};

const SmsProviderSection = ({
  config,
  values,
  secretPresence,
  secretClearRequested,
  isDefault,
  isSaving,
  isAnySaveInFlight,
  onValueChange,
  onRequestClearSecret,
  onCancelClearSecret,
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
        const isClearPending = secretClearRequested[field.key] === true;

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
              {field.isSecret && isConfigured && !isClearPending && (
                <Button
                  variant="outline"
                  color="danger"
                  size="sm"
                  onClick={() => onRequestClearSecret(field.key)}
                >
                  {t`Clear`}
                </Button>
              )}
              {field.isSecret && isClearPending && (
                <Button
                  variant="outline"
                  color="neutral"
                  size="sm"
                  onClick={() => onCancelClearSecret(field.key)}
                >
                  {t`Cancel clear`}
                </Button>
              )}
            </StyledFieldRow>
            <StyledFieldDescription>{field.description}</StyledFieldDescription>
            {field.isSecret && (
              <StyledStatus>
                {isClearPending
                  ? t`Will be cleared on save. Type a new value to keep it instead.`
                  : isConfigured
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
          disabled={isAnySaveInFlight}
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

  const { data, loading, error, refetch } = useQuery<
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
  // Secret intent per key: KEEP (absent), REPLACE (a typed replacement) or
  // CLEAR (explicitly requested). An empty input is KEEP, never CLEAR.
  const [secretFieldStateByKey, setSecretFieldStateByKey] = useState<
    Record<string, SecretFieldState>
  >({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [failedProviderId, setFailedProviderId] = useState<string | null>(null);

  // One synchronous lock for every write (provider selection and both saves),
  // so a fast double click cannot fire two overlapping requests. A ref, not
  // state: the guard must flip in the same tick the click is handled.
  // oxlint-disable-next-line twenty/no-state-useref
  const isWriteInFlightRef = useRef(false);

  const application = data?.findOneApplication ?? null;

  const loadState: CommunicationSmsLoadState = resolveCommunicationSmsLoadState(
    {
      loading,
      hasError: isDefined(error),
      hasApplication: isDefined(application),
    },
  );

  const runExclusive = useCallback(
    async <TResult,>(
      action: () => Promise<TResult>,
    ): Promise<TResult | undefined> => {
      if (isWriteInFlightRef.current) {
        return undefined;
      }

      isWriteInFlightRef.current = true;

      try {
        return await action();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [],
  );

  if (loadState.kind === 'LOADING') {
    return (
      <Section.Root>
        <StyledStatus>{t`Loading…`}</StyledStatus>
      </Section.Root>
    );
  }

  if (loadState.kind === 'ERROR') {
    return (
      <Section.Root>
        <Info
          accent="danger"
          text={t`The SMS settings could not be loaded. Check your access and connection, then reload.`}
        />
      </Section.Root>
    );
  }

  if (loadState.kind === 'NOT_INSTALLED' || !isDefined(application)) {
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

  // A secret field shows ONLY the replacement the user typed, never the stored
  // or masked value, so a saved secret can never leak back into the input.
  const readValue = (key: string): string =>
    secretPresenceByKey[key] === true
      ? resolveSecretInputValue(secretFieldStateByKey[key])
      : (draftValueByKey[key] ?? storedValueByKey[key] ?? '');

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
    if (providerId === selectedProviderId) {
      return;
    }

    const result = await runExclusive(async () => {
      try {
        await persistVariable(COMMUNICATION_PROVIDER_VARIABLE_KEY, providerId);

        // The write landed; a failed read-back must not read as a failed save.
        try {
          await refetch();
          enqueueToast({
            variant: 'success',
            children: t`Default provider saved.`,
          });
        } catch {
          enqueueToast({
            variant: 'warning',
            children: t`The default provider may have been saved, but it could not be re-read. Reload to see the saved value.`,
          });
        }
      } catch {
        enqueueToast({
          variant: 'error',
          children: t`Failed to save the default provider.`,
        });
      }

      return true;
    });

    // The lock dropped a click that overlapped another write; say so instead of
    // silently ignoring the user.
    if (result === undefined) {
      enqueueToast({
        variant: 'warning',
        children: t`Another save is in progress. Try again in a moment.`,
      });
    }
  };

  const handleSaveProvider = async (config: SmsProviderConfig) => {
    await runExclusive(async () => {
      setSavingProviderId(config.id);
      setFailedProviderId(null);

      try {
        // Snapshot the drafts as they are at the moment the save starts, so the
        // cleanup can tell "unchanged since submit" from "edited during save".
        const draftsAtSaveStart = draftValueByKey;
        const secretFieldsAtSaveStart = secretFieldStateByKey;

        const pendingWrites: { key: string; value: string }[] = [];

        for (const field of config.fields) {
          if (field.isSecret) {
            const secretWriteValue = resolveSecretWriteValue(
              secretFieldsAtSaveStart[field.key],
            );

            // KEEP writes nothing, so the stored secret stays untouched.
            if (isDefined(secretWriteValue)) {
              pendingWrites.push({ key: field.key, value: secretWriteValue });
            }
            continue;
          }

          const draftValue = draftsAtSaveStart[field.key];

          if (
            isDefined(draftValue) &&
            draftValue !== storedValueByKey[field.key]
          ) {
            pendingWrites.push({ key: field.key, value: draftValue });
          }
        }

        // Every write is attempted, even if an earlier one fails, so the
        // outcome can be reported per-write instead of guessed. A rejection is
        // handled here, never left unhandled.
        const results = await Promise.allSettled(
          pendingWrites.map((write) => persistVariable(write.key, write.value)),
        );

        const succeededCount = results.filter(
          (result) => result.status === 'fulfilled',
        ).length;
        const outcome: SaveOutcome = summarizeSaveOutcome({
          succeededCount,
          totalCount: pendingWrites.length,
        });

        const succeededKeys = pendingWrites
          .filter((_, index) => results[index].status === 'fulfilled')
          .map((write) => write.key);

        // Re-read before clearing anything, so the form shows what actually
        // landed rather than what was intended. A failed read-back must not
        // lock the UI or leave a draft in limbo: it is caught and reported
        // honestly, and every draft is kept.
        let didRefetchSucceed = true;

        try {
          await refetch();
        } catch {
          didRefetchSucceed = false;
        }

        if (didRefetchSucceed) {
          // Only keys whose draft is unchanged since submit are dropped; a
          // field edited during the save keeps its newer draft, even on the
          // same key.
          setDraftValueByKey((previous) =>
            dropUnchangedSucceededDrafts({
              latestDrafts: previous,
              draftsAtSaveStart,
              succeededKeys,
            }),
          );
          setSecretFieldStateByKey((previous) =>
            dropUnchangedSucceededDrafts({
              latestDrafts: previous,
              draftsAtSaveStart: secretFieldsAtSaveStart,
              succeededKeys,
            }),
          );
        } else {
          setFailedProviderId(config.id);
        }

        if (!didRefetchSucceed) {
          enqueueToast({
            variant: 'warning',
            children: t`The settings may have been saved, but they could not be re-read. Reload to see the saved values.`,
          });
        } else if (outcome === 'ALL_SAVED') {
          enqueueToast({
            variant: 'success',
            children: t`Settings saved.`,
          });
        } else if (outcome === 'PARTIAL') {
          setFailedProviderId(config.id);
          enqueueToast({
            variant: 'error',
            children: t`Some settings were saved and the rest failed to save.`,
          });
        } else {
          setFailedProviderId(config.id);
          enqueueToast({
            variant: 'error',
            children: t`The settings could not be saved.`,
          });
        }
      } finally {
        // Always releases the lock, so an unexpected failure cannot freeze the
        // form.
        setSavingProviderId(null);
      }
    });
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

  const isAnySaveInFlight = savingProviderId !== null;

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
              <Radio value={config.id} disabled={isAnySaveInFlight} />
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
                secretPresenceByKey[field.key] === true,
              ]),
          )}
          secretClearRequested={Object.fromEntries(
            config.fields
              .filter((field) => field.isSecret)
              .map((field) => [
                field.key,
                resolveSecretIntent(secretFieldStateByKey[field.key]) ===
                  'CLEAR',
              ]),
          )}
          isDefault={selectedProviderId === config.id}
          isSaving={savingProviderId === config.id}
          isAnySaveInFlight={isAnySaveInFlight}
          onValueChange={(key, value) => {
            const isSecretField = config.fields.some(
              (field) => field.key === key && field.isSecret,
            );

            if (isSecretField) {
              setSecretFieldStateByKey((previous) => ({
                ...previous,
                [key]: applySecretDraftChange({
                  previous: previous[key],
                  text: value,
                }),
              }));
              return;
            }

            setDraftValueByKey((previous) => ({ ...previous, [key]: value }));
          }}
          onRequestClearSecret={(key) =>
            setSecretFieldStateByKey((previous) => ({
              ...previous,
              [key]: requestSecretClear(),
            }))
          }
          onCancelClearSecret={(key) =>
            setSecretFieldStateByKey((previous) => {
              const next = { ...previous };
              delete next[key];
              return next;
            })
          }
          onSave={() => {
            void handleSaveProvider(config);
          }}
        />
      ))}

      {failedProviderId !== null && (
        <StyledWarningStatus>
          {t`Some settings may not have been saved. Reload to see the saved values.`}
        </StyledWarningStatus>
      )}

      <StyledStatus>
        {t`Saved values are stored per workspace. Secrets are never displayed again once saved. No connection is verified here.`}
      </StyledStatus>
      <StyledStatus>
        {t`Only the variables of the selected provider need to be filled in.`}
      </StyledStatus>
    </StyledContainer>
  );
};
