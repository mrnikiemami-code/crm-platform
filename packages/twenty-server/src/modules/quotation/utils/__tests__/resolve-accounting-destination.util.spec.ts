import {
  findValidWorkspaceDefaultConnection,
  resolveAccountingDestination,
} from 'src/modules/quotation/utils/resolve-accounting-destination.util';

const row = (
  overrides: Partial<{
    recordId: string;
    isActive: boolean;
    isDefault: boolean;
  }> = {},
) => ({
  recordId: 'a',
  isActive: true,
  isDefault: false,
  ...overrides,
});

describe('resolveAccountingDestination', () => {
  it('refuses when no connection id and no valid workspace default', () => {
    expect(
      resolveAccountingDestination({
        connections: [row({ recordId: 'a' }), row({ recordId: 'b' })],
      }),
    ).toEqual({
      kind: 'REFUSED',
      code: 'ACCOUNTING_DESTINATION_REQUIRED',
    });
  });

  it('never invents a default from row order or first-active', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ recordId: 'inactive', isActive: false }),
          row({ recordId: 'active' }),
        ],
      }),
    ).toMatchObject({ code: 'ACCOUNTING_DESTINATION_REQUIRED' });
  });

  it('uses the active workspace default when no id is named', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ recordId: 'a' }),
          row({ recordId: 'b', isDefault: true }),
        ],
      }),
    ).toEqual({
      kind: 'OK',
      recordId: 'b',
      source: 'workspace-default',
    });
  });

  it('ignores an inactive default instead of falling back', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ recordId: 'stale', isActive: false, isDefault: true }),
          row({ recordId: 'other' }),
        ],
      }),
    ).toMatchObject({ code: 'ACCOUNTING_DESTINATION_REQUIRED' });
  });

  it('honours an explicit active connection without requiring it to be default', () => {
    expect(
      resolveAccountingDestination({
        connections: [
          row({ recordId: 'a', isDefault: true }),
          row({ recordId: 'b' }),
        ],
        connectionId: 'b',
      }),
    ).toEqual({
      kind: 'OK',
      recordId: 'b',
      source: 'explicit',
    });
  });

  it('refuses an explicit inactive connection', () => {
    expect(
      resolveAccountingDestination({
        connections: [row({ recordId: 'a', isActive: false })],
        connectionId: 'a',
      }),
    ).toMatchObject({ code: 'CONNECTION_INACTIVE' });
  });

  it('refuses an explicit id from another set of rows', () => {
    expect(
      resolveAccountingDestination({
        connections: [row({ recordId: 'a' })],
        connectionId: 'foreign',
      }),
    ).toMatchObject({ code: 'ACCOUNTING_CONNECTION_NOT_FOUND' });
  });
});

describe('findValidWorkspaceDefaultConnection', () => {
  it('returns null when every default flag is false', () => {
    expect(
      findValidWorkspaceDefaultConnection([
        row({ recordId: 'a' }),
        row({ recordId: 'b' }),
      ]),
    ).toBeNull();
  });
});
