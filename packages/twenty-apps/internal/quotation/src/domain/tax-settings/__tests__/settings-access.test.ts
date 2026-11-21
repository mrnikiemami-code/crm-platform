import { describe, expect, it } from 'vitest';

import {
  holdsTaxSettingsPermission,
  mayChangeTaxSettings,
  readCallerPermissionFlags,
} from 'src/domain/tax-settings/settings-access';

describe('readCallerPermissionFlags', () => {
  it('reads the flags of a signed-in person', () => {
    expect(
      readCallerPermissionFlags({
        currentUser: {
          currentUserWorkspace: { permissionFlags: ['WORKSPACE', 'VIEWS'] },
        },
      }),
    ).toEqual(['WORKSPACE', 'VIEWS']);
  });

  it('treats a person without flags as an empty list, not as an application', () => {
    expect(
      readCallerPermissionFlags({
        currentUser: { currentUserWorkspace: { permissionFlags: [] } },
      }),
    ).toEqual([]);
  });

  it('returns null when the response carries no person', () => {
    expect(readCallerPermissionFlags({ currentUser: null })).toBeNull();
    expect(readCallerPermissionFlags({})).toBeNull();
  });
});

describe('holdsTaxSettingsPermission', () => {
  it('accepts a settings-level flag', () => {
    expect(holdsTaxSettingsPermission(['WORKSPACE'])).toBe(true);
    expect(holdsTaxSettingsPermission(['VIEWS', 'DATA_MODEL'])).toBe(true);
  });

  it('refuses a person holding only record-level flags', () => {
    expect(holdsTaxSettingsPermission(['VIEWS', 'IMPORT_CSV'])).toBe(false);
    expect(holdsTaxSettingsPermission([])).toBe(false);
  });
});

describe('mayChangeTaxSettings', () => {
  it('allows the trusted application path and admin people only', () => {
    expect(mayChangeTaxSettings(null)).toBe(true);
    expect(mayChangeTaxSettings(['WORKSPACE'])).toBe(true);
    expect(mayChangeTaxSettings(['VIEWS'])).toBe(false);
  });
});
