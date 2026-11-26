import { describe, expect, it } from 'vitest';

import {
  resolveAccountingDestination,
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
