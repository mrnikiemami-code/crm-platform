import { describe, expect, it } from 'vitest';

import {
  resolveAccountingDestination,
  resolveTemporaryWorkingConnectionId,
} from 'src/domain/accounting/resolve-destination';

const row = (
  overrides: Partial<{ id: string; isActive: boolean; isDefault: boolean }> = {},
) => ({
  id: 'a',
  isActive: true,
  isDefault: false,
  ...overrides,
});

describe('resolveAccountingDestination (app)', () => {
  it('requires an explicit workspace default when no id is named', () => {
    expect(
      resolveAccountingDestination({
        connections: [row({ id: 'a' }), row({ id: 'b', isActive: true })],
      }),
    ).toEqual({
      kind: 'REFUSED',
      code: 'ACCOUNTING_DESTINATION_REQUIRED',
    });
  });

  it('returns the workspace default for settings and quotation consumers', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ id: 'a' }),
          row({ id: 'b', isDefault: true }),
        ],
      }),
    ).toEqual({
      kind: 'OK',
      connectionId: 'b',
      source: 'workspace-default',
    });
  });

  it('keeps temporary explicit selection separate from the default', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ id: 'default', isDefault: true }),
          row({ id: 'temporary' }),
        ],
        connectionId: 'temporary',
      }),
    ).toEqual({
      kind: 'OK',
      connectionId: 'temporary',
      source: 'explicit',
    });
  });
});

describe('resolveTemporaryWorkingConnectionId', () => {
  it('prefers the remembered temporary id when it still exists', () => {
    expect(
      resolveTemporaryWorkingConnectionId({
        connections: [
          row({ id: 'default', isDefault: true }),
          row({ id: 'temp' }),
        ],
        rememberedConnectionId: 'temp',
      }),
    ).toBe('temp');
  });

  it('falls back to the workspace default, never the first row', () => {
    expect(
      resolveTemporaryWorkingConnectionId({
        connections: [
          row({ id: 'first' }),
          row({ id: 'default', isDefault: true }),
        ],
        rememberedConnectionId: null,
      }),
    ).toBe('default');
  });

  it('returns null when neither remembered nor default exists', () => {
    expect(
      resolveTemporaryWorkingConnectionId({
        connections: [row({ id: 'a' }), row({ id: 'b' })],
        rememberedConnectionId: 'gone',
      }),
    ).toBeNull();
  });
});
