import { describe, expect, it } from 'vitest';

import {
  applyPhoneOverrides,
  recomputeSharedPhoneWarnings,
  resolveBulkRecipients,
  type BulkRecipient,
} from 'src/bulk/resolve-bulk-recipients';

const person = (
  id: string,
  options: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    additionalPhones?: string[];
    noPhones?: boolean;
  } = {},
) => ({
  id,
  name: {
    firstName: options.firstName ?? null,
    lastName: options.lastName ?? null,
  },
  company: { name: options.companyName ?? null },
  phones: options.noPhones
    ? null
    : {
        primaryPhoneNumber: options.primaryPhone ?? null,
        additionalPhones: (options.additionalPhones ?? []).map((number) => ({
          number,
        })),
      },
});

describe('resolveBulkRecipients', () => {
  it('shows every selected id, in order, with its number', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1', 'p2', 'p3'],
      persons: [
        person('p1', { firstName: 'سارا', primaryPhone: '09120000001' }),
        person('p2', { firstName: 'رضا', primaryPhone: '09120000002' }),
        person('p3', { firstName: 'مینا', primaryPhone: '09120000003' }),
      ],
    });

    expect(resolution.recipients.map((r) => r.personId)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
    expect(resolution.recipients.map((r) => r.displayName)).toEqual([
      'سارا',
      'رضا',
      'مینا',
    ]);
    expect(resolution.recipients.every((r) => r.status === 'SENDABLE')).toBe(
      true,
    );
    expect(resolution.sendableCount).toBe(3);
    expect(resolution.unsendableCount).toBe(0);
  });

  it('collapses duplicate ids and reports them', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1', 'p2', 'p1', 'p1'],
      persons: [person('p1', { primaryPhone: '09120000001' })],
    });

    expect(resolution.recipients.map((r) => r.personId)).toEqual(['p1', 'p2']);
    expect(resolution.duplicatePersonIds).toEqual(['p1']);
  });

  it('marks a Person with no phone as NO_PHONE and unsendable', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1', 'p2'],
      persons: [
        person('p1', { primaryPhone: '09120000001' }),
        person('p2', { noPhones: true }),
      ],
    });

    const p2 = resolution.recipients.find((r) => r.personId === 'p2');

    expect(p2?.status).toBe('NO_PHONE');
    expect(p2?.selectedPhone).toBeNull();
    expect(resolution.sendableCount).toBe(1);
    expect(resolution.unsendableCount).toBe(1);
  });

  it('marks a requested Person absent from the read as NOT_ACCESSIBLE (never dropped)', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1', 'forbidden'],
      persons: [person('p1', { primaryPhone: '09120000001' })],
    });

    const forbidden = resolution.recipients.find(
      (r) => r.personId === 'forbidden',
    );

    expect(forbidden?.status).toBe('NOT_ACCESSIBLE');
    expect(forbidden?.displayName).toBe('forbidden');
    expect(resolution.unsendableCount).toBe(1);
  });

  it('exposes multiple numbers and preselects the primary one', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1'],
      persons: [
        person('p1', {
          primaryPhone: '09120000001',
          additionalPhones: ['09350000001', '09350000002'],
        }),
      ],
    });

    const p1 = resolution.recipients[0];

    expect(p1.phones.map((phone) => phone.value)).toEqual([
      '09120000001',
      '09350000001',
      '09350000002',
    ]);
    expect(p1.selectedPhone).toBe('09120000001');
  });

  it('warns when two distinct recipients share the same number', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1', 'p2', 'p3'],
      persons: [
        person('p1', { primaryPhone: '09120000001' }),
        person('p2', { primaryPhone: '09120000001' }),
        person('p3', { primaryPhone: '09120000009' }),
      ],
    });

    expect(resolution.sharedPhoneWarnings).toEqual([
      { phone: '09120000001', personIds: ['p1', 'p2'] },
    ]);
  });

  it('does not warn when the same number belongs to one person via two entries', () => {
    const resolution = resolveBulkRecipients({
      requestedPersonIds: ['p1'],
      persons: [
        person('p1', {
          primaryPhone: '09120000001',
          additionalPhones: ['09120000001'],
        }),
      ],
    });

    expect(resolution.sharedPhoneWarnings).toEqual([]);
  });
});

const buildRecipient = (
  personId: string,
  selectedPhone: string | null,
  phoneValues: string[] = selectedPhone === null ? [] : [selectedPhone],
): BulkRecipient => ({
  personId,
  displayName: personId,
  status: selectedPhone === null ? 'NO_PHONE' : 'SENDABLE',
  phones: phoneValues.map((value, index) => ({
    id: index === 0 ? 'primary' : `additional-${index}`,
    value,
    isPrimary: index === 0,
  })),
  selectedPhone,
});

describe('applyPhoneOverrides', () => {
  it('accepts an override that is one of the person numbers', () => {
    const recipients = [
      buildRecipient('p1', '09120000001', ['09120000001', '09350000001']),
    ];

    const applied = applyPhoneOverrides({
      recipients,
      overrides: { p1: '09350000001' },
    });

    expect(applied.invalidOverrides).toEqual([]);
    expect(applied.recipients[0].selectedPhone).toBe('09350000001');
  });

  it('reports an invalid override and leaves the person number untouched (no silent substitution)', () => {
    const recipients = [buildRecipient('p1', '09120000001')];

    const applied = applyPhoneOverrides({
      recipients,
      overrides: { p1: '09999999999' },
    });

    expect(applied.invalidOverrides).toEqual(['p1']);
    // The recipient keeps its OWN number; the bogus number is not used.
    expect(applied.recipients[0].selectedPhone).toBe('09120000001');
  });
});

describe('recomputeSharedPhoneWarnings', () => {
  it('reflects the CURRENT selections, not the defaults', () => {
    const recipients = [
      buildRecipient('p1', '09120000002', ['09120000001', '09120000002']),
      buildRecipient('p2', '09120000002'),
    ];

    expect(recomputeSharedPhoneWarnings(recipients)).toEqual([
      { phone: '09120000002', personIds: ['p1', 'p2'] },
    ]);
  });

  it('drops the warning when only one recipient remains on a number', () => {
    const recipients = [buildRecipient('p1', '09120000001')];

    expect(recomputeSharedPhoneWarnings(recipients)).toEqual([]);
  });
});
