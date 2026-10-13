import { describe, expect, it } from 'vitest';

import communicationObject from 'src/objects/communication.object';
import { resolveProviderLabel } from 'src/timeline/communication-timeline-presentation';

// Locks the W16-R5 decision: the Communication object's SELECT options carry
// PERSIAN labels for the workspace while keeping their stable machine `value`.
// The platform has no per-locale option-label mechanism for app-defined
// options, so the Persian-first app authors the labels in Persian here.
type Option = { value: string; label: string };

const fields = (
  communicationObject.config as unknown as {
    fields: { name: string; options?: Option[] }[];
  }
).fields;

const optionsOf = (fieldName: string): Option[] =>
  fields.find((field) => field.name === fieldName)?.options ?? [];

describe('Communication object option labels (Persian, stable values)', () => {
  it('labels the channel option «پیامک» while keeping the SMS value', () => {
    expect(optionsOf('channel')).toEqual([
      expect.objectContaining({ value: 'SMS', label: 'پیامک' }),
    ]);
  });

  it('labels every status option in Persian with its stable value', () => {
    const byValue = Object.fromEntries(
      optionsOf('status').map((option) => [option.value, option.label]),
    );

    expect(byValue).toEqual({
      QUEUED: 'در صف',
      SENT: 'ارسال شد',
      DELIVERED: 'تحویل شد',
      FAILED: 'ناموفق',
    });
  });

  it('labels the direction option «خروجی» with its stable value', () => {
    expect(optionsOf('direction')).toEqual([
      expect.objectContaining({ value: 'OUTBOUND', label: 'خروجی' }),
    ]);
  });

  it('presents the provider id through a Persian label map, not a raw value', () => {
    // The platform does not apply a field TYPE change, so the provider stays
    // TEXT; the app presents the Persian name through this shared map on its
    // own surfaces (timeline card, composer).
    expect(resolveProviderLabel('razpayamak')).toBe('رازپیامک');
    expect(resolveProviderLabel('kavenegar')).toBe('کاوه‌نگار');
    expect(resolveProviderLabel(null)).toBeNull();
    // An unknown id is shown as-is rather than hidden.
    expect(resolveProviderLabel('other')).toBe('other');
  });
});
