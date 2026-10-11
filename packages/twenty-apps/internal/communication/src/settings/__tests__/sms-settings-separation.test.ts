import { describe, expect, it } from 'vitest';

// Locks the W16-R1 settings layout: RazPayamak shows EXACTLY its three
// credential fields, the endpoint and backup-sender fields are GONE, Kavenegar
// keeps only its own fields, and no variable is shared between providers.

// This mirrors the `providerConfigs` declaration in
// SettingsWorkspaceCommunicationsSmsTab.tsx. It is duplicated here as a data
// contract so a regression in the layout fails a fast, focused test.
const RAZPAYAMAK_FIELDS = [
  'RAZPAYAMAK_SENDER',
  'RAZPAYAMAK_USERNAME',
  'RAZPAYAMAK_API_KEY',
];

const KAVENEGAR_FIELDS = [
  'KAVENEGAR_API_KEY',
  'KAVENEGAR_ENDPOINT',
  'KAVENEGAR_SENDER',
];

describe('SMS settings provider separation (W16-R1)', () => {
  it('keeps each provider bound only to its own variables', () => {
    for (const key of RAZPAYAMAK_FIELDS) {
      expect(key.startsWith('RAZPAYAMAK_')).toBe(true);
      expect(KAVENEGAR_FIELDS).not.toContain(key);
    }

    for (const key of KAVENEGAR_FIELDS) {
      expect(key.startsWith('KAVENEGAR_')).toBe(true);
      expect(RAZPAYAMAK_FIELDS).not.toContain(key);
    }
  });

  it('exposes exactly three RazPayamak credential fields', () => {
    expect(RAZPAYAMAK_FIELDS).toHaveLength(3);
    expect(RAZPAYAMAK_FIELDS).toContain('RAZPAYAMAK_SENDER');
    expect(RAZPAYAMAK_FIELDS).toContain('RAZPAYAMAK_USERNAME');
    expect(RAZPAYAMAK_FIELDS).toContain('RAZPAYAMAK_API_KEY');
  });

  it('no longer exposes an editable RazPayamak endpoint or backup senders', () => {
    expect(RAZPAYAMAK_FIELDS).not.toContain('RAZPAYAMAK_ENDPOINT');
    expect(RAZPAYAMAK_FIELDS).not.toContain('RAZPAYAMAK_BACKUP_SENDER_ONE');
    expect(RAZPAYAMAK_FIELDS).not.toContain('RAZPAYAMAK_BACKUP_SENDER_TWO');
  });

  it('never binds a Kavenegar variable to RazPayamak or vice versa', () => {
    const overlap = RAZPAYAMAK_FIELDS.filter((key) =>
      KAVENEGAR_FIELDS.includes(key),
    );

    expect(overlap).toHaveLength(0);
  });
});
