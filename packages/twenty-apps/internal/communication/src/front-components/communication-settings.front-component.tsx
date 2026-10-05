import { defineSettingsFrontComponent } from 'twenty-sdk/define';
import { getApplicationVariable, t } from 'twenty-sdk/front-component';

import { COMMUNICATION_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildCommunicationSettingsView } from 'src/settings/communication-settings-view';

// Native settings entry. Twenty renders this component inside the application
// settings page (Settings → Applications → Communication), which is also where
// the native variables screen lets an administrator edit the declared
// application variables.
//
// This component is READ-ONLY. It reports configuration readiness and never
// displays or requests a secret value:
//   - `getApplicationVariable` reads the non-secret variables the platform
//     exposes to a front component (the server filters out `isSecret: true`
//     values before they reach the sandbox).
//   - Secret presence is shown by the NATIVE variables screen, which masks
//     stored values; this component never asks for plaintext.
const CommunicationSettings = () => {
  const view = buildCommunicationSettingsView({
    provider: getApplicationVariable('COMMUNICATION_PROVIDER'),
    kavenegar: {
      endpoint: getApplicationVariable('KAVENEGAR_ENDPOINT'),
      sender: getApplicationVariable('KAVENEGAR_SENDER'),
    },
    razpayamak: {
      username: getApplicationVariable('RAZPAYAMAK_USERNAME'),
      sender: getApplicationVariable('RAZPAYAMAK_SENDER'),
    },
  });

  return (
    <div
      data-communication-settings="1"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>{t('Communication')}</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          {t(
            'Outbound sending configuration. Credentials are stored in the application variables on this page and are never displayed here.',
          )}
        </p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>{t('Default provider')}</strong>
        <span data-communication-provider={view.providerId ?? ''}>
          {view.providerId ?? t('Not configured')}
        </span>
        <span style={{ opacity: 0.7 }}>{t(view.readinessMessage)}</span>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>{t('Implemented providers')}</strong>
        {view.providers.map((provider) => (
          <div
            key={provider.id}
            data-communication-provider-row={provider.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span>
              {provider.label}
              {provider.isDefault ? ` — ${t('default')}` : ''}
            </span>
            <span style={{ opacity: 0.7 }}>
              {provider.isConfigured
                ? t('Sender configuration present')
                : t('Sender configuration missing')}
            </span>
            <span style={{ opacity: 0.7 }}>
              {t('Credential is managed on this page and never shown.')}
            </span>
          </div>
        ))}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>{t('Channel')}</strong>
        <span>{view.channels.join(', ')}</span>
      </section>
    </div>
  );
};

export default defineSettingsFrontComponent({
  universalIdentifier:
    COMMUNICATION_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'communication-settings',
  description: 'Communication configuration and readiness.',
  component: CommunicationSettings,
});
