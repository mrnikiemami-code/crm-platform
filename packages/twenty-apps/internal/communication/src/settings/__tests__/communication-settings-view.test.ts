import { describe, expect, it } from 'vitest';

import {
  buildCommunicationSettingsView,
  IMPLEMENTED_COMMUNICATION_PROVIDERS,
} from 'src/settings/communication-settings-view';

const configuredRazpayamak = {
  username: 'panel-user',
  sender: '100020003000',
};

const configuredKavenegar = {
  endpoint: 'https://api.kavenegar.test/v1',
  sender: '10004346',
};

describe('buildCommunicationSettingsView', () => {
  it('lists only implemented providers', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providers.map((provider) => provider.id)).toEqual([
      'razpayamak',
      'kavenegar',
    ]);
    expect(view.providers).toHaveLength(
      IMPLEMENTED_COMMUNICATION_PROVIDERS.length,
    );
  });

  it('marks the configured default provider', () => {
    const view = buildCommunicationSettingsView({
      provider: 'kavenegar',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providerId).toBe('kavenegar');
    expect(
      view.providers.find((provider) => provider.id === 'kavenegar')?.isDefault,
    ).toBe(true);
    expect(
      view.providers.find((provider) => provider.id === 'razpayamak')?.isDefault,
    ).toBe(false);
  });

  it('reports a missing default provider', () => {
    const view = buildCommunicationSettingsView({
      provider: undefined,
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providerId).toBeNull();
    expect(view.isProviderSelected).toBe(false);
    expect(view.observation).toContain('No default provider is selected');
    expect(view.observation).toContain('Variables tab');
  });

  it('rejects an unknown provider id instead of offering it', () => {
    const view = buildCommunicationSettingsView({
      provider: 'melipayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providerId).toBeNull();
    expect(JSON.stringify(view)).not.toContain('melipayamak');
  });

  it('reports missing non-secret configuration for the selected provider', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: { username: 'panel-user', sender: undefined },
    });

    expect(view.observation).toContain('non-secret configuration is incomplete');
    expect(
      view.providers.find((provider) => provider.id === 'razpayamak')
        ?.hasVisibleConfiguration,
    ).toBe(false);
  });

  it('never claims readiness even when every visible field is present', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    // All observable non-secret fields exist, but the secret credential is
    // invisible to frontend code and no connectivity check runs, so readiness
    // cannot be asserted.
    expect(view.providers.every((provider) => provider.hasVisibleConfiguration)).toBe(
      true,
    );
    expect(view.observation).not.toContain('Ready to send');
    expect(view.observation).toContain('NOT verified');
    expect(JSON.stringify(view)).not.toContain('isReady');
  });

  it('treats blank values as missing configuration', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: { endpoint: '  ', sender: '  ' },
      razpayamak: { username: '', sender: '   ' },
    });

    expect(
      view.providers.every((provider) => !provider.hasVisibleConfiguration),
    ).toBe(true);
  });

  it('offers only implemented channels', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.channels).toEqual(['SMS']);
  });

  it('never carries a credential value in its output', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(JSON.stringify(view)).not.toContain('100020003000');
    expect(JSON.stringify(view)).not.toContain('10004346');
    expect(JSON.stringify(view)).not.toContain('api.kavenegar.test');
  });
});
