import { describe, expect, it } from 'vitest';

import {
  resolveComposerMode,
  resolveSingleRecordId,
} from 'src/components/composer-selection-mode';

describe('resolveComposerMode', () => {
  it('is NONE when nothing is selected', () => {
    expect(resolveComposerMode([])).toBe('NONE');
  });

  it('is SINGLE for exactly one selected record', () => {
    expect(resolveComposerMode(['p1'])).toBe('SINGLE');
  });

  it('is BULK for more than one selected record', () => {
    expect(resolveComposerMode(['p1', 'p2'])).toBe('BULK');
    expect(resolveComposerMode(['p1', 'p2', 'p3'])).toBe('BULK');
  });
});

describe('resolveSingleRecordId', () => {
  it('returns the id only when exactly one record is selected', () => {
    expect(resolveSingleRecordId(['p1'])).toBe('p1');
    expect(resolveSingleRecordId(['p1', 'p2'])).toBeNull();
    expect(resolveSingleRecordId([])).toBeNull();
  });
});
