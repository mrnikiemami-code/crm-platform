import { describe, expect, it } from 'vitest';

import applicationConfigResult from 'src/application.config';
import {
  COMMUNICATION_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER,
  KAVENEGAR_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Locks the W9-R2 decision: provider configuration is **workspace-owned**.
//
// `serverVariables` live on the application registration and are therefore
// shared by every workspace that installs the app, so two workspaces could never
// use different provider accounts. `applicationVariables` are materialised per
// workspace, encrypted with the workspace key and injected only into that
// workspace's function execution context, which is what per-workspace
// credentials require.

const config = applicationConfigResult.config as unknown as {
  serverVariables?: Record<string, unknown>;
  applicationVariables?: Record<
    string,
    { universalIdentifier?: string; isSecret?: boolean }
  >;
};

const EXPECTED_VARIABLES: Record<string, { isSecret: boolean }> = {
  COMMUNICATION_PROVIDER: { isSecret: false },
  KAVENEGAR_ENDPOINT: { isSecret: false },
  KAVENEGAR_API_KEY: { isSecret: true },
  KAVENEGAR_SENDER: { isSecret: false },
  RAZPAYAMAK_USERNAME: { isSecret: false },
  RAZPAYAMAK_API_KEY: { isSecret: true },
  RAZPAYAMAK_SENDER: { isSecret: false },
  RAZPAYAMAK_BACKUP_SENDER_ONE: { isSecret: false },
  RAZPAYAMAK_BACKUP_SENDER_TWO: { isSecret: false },
};

describe('workspace application variable declaration (W9-R2)', () => {
  it('declares every provider variable as a workspace application variable', () => {
    const declared = Object.keys(config.applicationVariables ?? {}).sort();

    expect(declared).toEqual(Object.keys(EXPECTED_VARIABLES).sort());
  });

  it('removes the shared registration-scoped declarations entirely', () => {
    // Leaving any key in `serverVariables` would keep it shared across
    // workspaces and, because the executor merges the registration map first,
    // a stale shared value could shadow the workspace value.
    expect(config.serverVariables ?? {}).toEqual({});
  });

  it('keeps the existing variable keys (no rename)', () => {
    expect(Object.keys(config.applicationVariables ?? {})).toContain(
      'COMMUNICATION_PROVIDER',
    );
    expect(Object.keys(config.applicationVariables ?? {})).toContain(
      'KAVENEGAR_API_KEY',
    );
    expect(Object.keys(config.applicationVariables ?? {})).toContain(
      'RAZPAYAMAK_API_KEY',
    );
  });

  it('keeps API keys secret and non-credential config non-secret', () => {
    for (const [key, expected] of Object.entries(EXPECTED_VARIABLES)) {
      expect(
        config.applicationVariables?.[key]?.isSecret,
        `${key} isSecret`,
      ).toBe(expected.isSecret);
    }
  });

  it('gives every variable a stable, valid universal identifier', () => {
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const identifiers = Object.entries(config.applicationVariables ?? {}).map(
      ([key, variable]) => {
        expect(variable.universalIdentifier, `${key} identifier`).toBeDefined();
        expect(
          uuidV4.test(variable.universalIdentifier ?? ''),
          `${key} identifier must be a valid UUID v4`,
        ).toBe(true);

        return variable.universalIdentifier;
      },
    );

    // Stable means unique: two variables sharing an identifier would collide in
    // the platform's universal-identifier-keyed sync.
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('pins the identifiers that must never change', () => {
    // A changed identifier is treated by the platform as a different variable,
    // which would orphan the value a workspace had already stored.
    expect(
      config.applicationVariables?.COMMUNICATION_PROVIDER
        ?.universalIdentifier,
    ).toBe(COMMUNICATION_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER);
    expect(
      config.applicationVariables?.KAVENEGAR_API_KEY?.universalIdentifier,
    ).toBe(KAVENEGAR_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER);
    expect(
      config.applicationVariables?.RAZPAYAMAK_API_KEY?.universalIdentifier,
    ).toBe(RAZPAYAMAK_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER);
  });

  it('leaves optional provider configuration optional', () => {
    // The 2.35.0 application-variable contract has no `isRequired` field, so a
    // variable must never be marked required — an unused provider has to remain
    // installable without any value.
    for (const [key, variable] of Object.entries(
      config.applicationVariables ?? {},
    )) {
      expect(
        (variable as { isRequired?: boolean }).isRequired,
        `${key} must not be required`,
      ).toBeUndefined();
    }
  });
});
