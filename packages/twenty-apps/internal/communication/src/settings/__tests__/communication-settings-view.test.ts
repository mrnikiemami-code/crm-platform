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
    // Nothing beyond the implemented set is ever offered.
    expect(view.providers).toHaveLength(IMPLEMENTED_COMMUNICATION_PROVIDERS.length);
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

  it('reports readiness when the default provider is configured', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.isProviderSelected).toBe(true);
    expect(view.isReady).toBe(true);
    expect(view.readinessMessage).toBe('Ready to send.');
  });

  it('reports a missing default provider', () => {
    const view = buildCommunicationSettingsView({
      provider: undefined,
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providerId).toBeNull();
    expect(view.isProviderSelected).toBe(false);
    expect(view.isReady).toBe(false);
    expect(view.readinessMessage).toContain('No default provider is selected');
  });

  it('rejects an unknown provider id instead of offering it', () => {
    const view = buildCommunicationSettingsView({
      provider: 'melipayamak',
      kavenegar: configuredKavenegar,
      razpayamak: configuredRazpayamak,
    });

    expect(view.providerId).toBeNull();
    expect(view.isReady).toBe(false);
    expect(JSON.stringify(view)).not.toContain('melipayamak');
  });

  it('reports missing sender configuration for the selected provider', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: configuredKavenegar,
      razpayamak: { username: 'panel-user', sender: undefined },
    });

    expect(view.isReady).toBe(false);
    expect(view.readinessMessage).toContain('missing its sender configuration');
    expect(
      view.providers.find((provider) => provider.id === 'razpayamak')
        ?.isConfigured,
    ).toBe(false);
  });

  it('treats blank values as missing configuration', () => {
    const view = buildCommunicationSettingsView({
      provider: 'razpayamak',
      kavenegar: { endpoint: '  ', sender: '  ' },
      razpayamak: { username: '', sender: '   ' },
    });

    expect(view.isReady).toBe(false);
    expect(view.providers.every((provider) => !provider.isConfigured)).toBe(
      true,
    );
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

    // Only presence is reported; the values themselves never leave the input.
    expect(JSON.stringify(view)).not.toContain('100020003000');
    expect(JSON.stringify(view)).not.toContain('10004346');
    expect(JSON.stringify(view)).not.toContain('api.kavenegar.test');
  });
});
