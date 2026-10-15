import { describe, expect, it } from 'vitest';

import {
  readRecordLabel,
  UNTITLED_RECORD_LABEL,
} from 'src/templates/data/read-source-record-relation';

// Sample titles come from each object's OWN label-identifier field. Only Person
// happens to have `name.firstName/lastName`, so assuming that shape for every
// object produced blank options — which is exactly what these lock against.
describe('source record labels', () => {
  it('reads a scalar label field', () => {
    expect(
      readRecordLabel({ id: 'a', title: 'Follow-up call' }, 'title'),
    ).toBe('Follow-up call');
  });

  it('reads a composite FULL_NAME label field', () => {
    expect(
      readRecordLabel(
        { id: 'a', name: { firstName: 'Sara', lastName: 'Ahmadi' } },
        'name',
      ),
    ).toBe('Sara Ahmadi');
  });

  it('reads a composite that has only one part', () => {
    expect(
      readRecordLabel({ id: 'a', name: { firstName: 'Sara' } }, 'name'),
    ).toBe('Sara');
  });

  it('NEVER returns an empty label — an untitled record is named', () => {
    // A blank option is indistinguishable from a loading bug, so every one of
    // these must produce the explicit fallback instead.
    const cases: [string | null, Record<string, unknown>][] = [
      [null, { id: 'a', title: 'ignored' }],
      ['title', { id: 'a' }],
      ['title', { id: 'a', title: '' }],
      ['title', { id: 'a', title: '   ' }],
      ['title', { id: 'a', title: null }],
      ['title', { id: 'a', title: 42 }],
      ['name', { id: 'a', name: null }],
      ['name', { id: 'a', name: {} }],
      ['name', { id: 'a', name: { firstName: '  ', lastName: '' } }],
    ];

    for (const [field, node] of cases) {
      const label = readRecordLabel(node, field);

      expect(label, `${field} / ${JSON.stringify(node)}`).toBe(
        UNTITLED_RECORD_LABEL,
      );
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('names the fallback in Persian, not an empty string', () => {
    expect(UNTITLED_RECORD_LABEL).toBe('بدون عنوان');
  });
});
