import {
  accountingConnectionColumnsFromSettings,
  isKnownAccountingAdapterId,
  parseAccountingBaseUrl,
  parseAccountingConnectionSettings,
} from 'src/modules/quotation/utils/accounting-connection-settings.util';

describe('parseAccountingBaseUrl', () => {
  it('accepts an absolute credential-free address and trims the trailing slash', () => {
    expect(parseAccountingBaseUrl('  https://asan.example.ir/api/  ')).toEqual({
      ok: true,
      value: 'https://asan.example.ir/api',
    });
  });

  it('refuses a missing address', () => {
    expect(parseAccountingBaseUrl('   ')).toMatchObject({
      ok: false,
      code: 'CONNECTION_BASE_URL_REQUIRED',
    });
  });

  it('refuses anything that is not http or https', () => {
    expect(parseAccountingBaseUrl('ftp://asan.example.ir')).toMatchObject({
      ok: false,
      code: 'CONNECTION_BASE_URL_INVALID',
    });
    expect(parseAccountingBaseUrl('file:///etc/passwd')).toMatchObject({
      ok: false,
      code: 'CONNECTION_BASE_URL_INVALID',
    });
  });

  it('refuses a password inside the address, because it would land in logs and backups', () => {
    expect(
      parseAccountingBaseUrl('https://admin:secret@asan.example.ir'),
    ).toMatchObject({
      ok: false,
      code: 'CONNECTION_BASE_URL_HAS_CREDENTIALS',
    });
  });

  it('refuses a query string or fragment', () => {
    expect(parseAccountingBaseUrl('https://asan.example.ir/?key=1')).toMatchObject(
      { ok: false, code: 'CONNECTION_BASE_URL_INVALID' },
    );
    expect(parseAccountingBaseUrl('https://asan.example.ir/#top')).toMatchObject({
      ok: false,
      code: 'CONNECTION_BASE_URL_INVALID',
    });
  });
});

describe('parseAccountingConnectionSettings', () => {
  it('keeps the safe defaults and normalizes an unknown unit to UNCONFIRMED', () => {
    const parsed = parseAccountingConnectionSettings({
      baseUrl: 'https://asan.example.ir',
      moneyUnit: 'DOLLAR',
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.moneyUnit).toBe('UNCONFIRMED');
      expect(parsed.value.transportApproved).toBe(false);
      expect(parsed.value.specialCodes).toEqual({
        discount: false,
        duty: false,
        tax: false,
      });
    }
  });

  it('refuses a private-network destination until the transport is approved', () => {
    expect(
      parseAccountingConnectionSettings({
        baseUrl: 'http://10.1.2.3:8080',
      }),
    ).toMatchObject({
      ok: false,
      code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED',
    });

    expect(
      parseAccountingConnectionSettings(
        {
          baseUrl: 'http://127.0.0.1:8080',
          transportApproved: true,
        },
        {
          privateDestinationAllowlist: [
            { host: '127.0.0.1', port: 8080 },
          ],
        },
      ),
    ).toMatchObject({
      ok: false,
      code: 'CONNECTION_DESTINATION_BLOCKED',
    });
  });

  it('does not let transport approval alone unlock the internal network', () => {
    expect(
      parseAccountingConnectionSettings({
        baseUrl: 'http://192.168.1.10:8080',
        transportApproved: true,
      }),
    ).toMatchObject({
      ok: false,
      code: 'CONNECTION_DESTINATION_NOT_ALLOWLISTED',
    });

    expect(
      parseAccountingConnectionSettings(
        {
          baseUrl: 'http://192.168.1.10:8080',
          transportApproved: true,
        },
        {
          privateDestinationAllowlist: [
            { host: '192.168.1.10', port: 8080 },
          ],
        },
      ),
    ).toMatchObject({ ok: true });
  });

  it('never stores the cloud metadata address, even when allowlisted', () => {
    expect(
      parseAccountingConnectionSettings(
        {
          baseUrl: 'http://169.254.169.254/latest',
          transportApproved: true,
        },
        {
          privateDestinationAllowlist: [
            { host: '169.254.169.254', port: null },
          ],
        },
      ),
    ).toMatchObject({
      ok: false,
      code: 'CONNECTION_DESTINATION_BLOCKED',
    });
  });

  it('refuses a non-numeric vendor user id or warehouse id', () => {
    expect(
      parseAccountingConnectionSettings({
        baseUrl: 'https://asan.example.ir',
        remoteUserId: 'admin',
      }),
    ).toMatchObject({ ok: false, code: 'CONNECTION_REMOTE_USER_INVALID' });

    expect(
      parseAccountingConnectionSettings({
        baseUrl: 'https://asan.example.ir',
        defaultStorageId: 'store-1',
      }),
    ).toMatchObject({ ok: false, code: 'CONNECTION_STORAGE_INVALID' });
  });

  it('drops a blank entry from the tax mapping instead of treating it as mapped', () => {
    const parsed = parseAccountingConnectionSettings({
      baseUrl: 'https://asan.example.ir',
      specialCodes: { taxPolicyMappings: { IR_VAT_9: '999141', EMPTY: '  ' } },
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.specialCodes.taxPolicyMappings).toEqual({
        IR_VAT_9: '999141',
      });
    }
  });

  // The settings page sends the codes at the top level of its settings object. Reading only
  // the nested copy made a typed code vanish on save, so a code-mapping destination was
  // reported as unmapped forever.
  it('stores a tax code sent at the top level of the settings object', () => {
    const parsed = parseAccountingConnectionSettings({
      baseUrl: 'https://asan.example.ir',
      taxPolicyMappings: { IR_VAT_9: 'TAX-01' },
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.specialCodes.taxPolicyMappings).toEqual({
        IR_VAT_9: 'TAX-01',
      });
    }
  });

  it('lets the top-level tax code win over the legacy nested copy', () => {
    const parsed = parseAccountingConnectionSettings({
      baseUrl: 'https://asan.example.ir',
      specialCodes: { taxPolicyMappings: { IR_VAT_9: 'OLD-9' } },
      taxPolicyMappings: { IR_VAT_9: 'TAX-01', IR_VAT_10: 'TAX-02' },
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.specialCodes.taxPolicyMappings).toEqual({
        IR_VAT_9: 'TAX-01',
        IR_VAT_10: 'TAX-02',
      });
    }
  });
});

describe('accountingConnectionColumnsFromSettings', () => {
  it('resets health on every settings change so an old green check cannot survive', () => {
    const parsed = parseAccountingConnectionSettings({
      baseUrl: 'https://asan.example.ir',
      moneyUnit: 'RIAL',
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(accountingConnectionColumnsFromSettings(parsed.value)).toMatchObject({
        baseUrl: 'https://asan.example.ir',
        moneyUnit: 'RIAL',
        healthState: 'UNKNOWN',
      });
    }
  });
});

describe('isKnownAccountingAdapterId', () => {
  it('admits only adapters that actually exist', () => {
    expect(isKnownAccountingAdapterId('mock')).toBe(true);
    expect(isKnownAccountingAdapterId('asan')).toBe(true);
    expect(isKnownAccountingAdapterId('sepidar')).toBe(false);
  });
});
