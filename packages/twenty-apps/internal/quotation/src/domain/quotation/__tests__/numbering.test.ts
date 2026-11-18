import { describe, expect, it } from 'vitest';

import {
  allocateQuotationNumber,
  buildSequenceScopeKey,
  formatQuotationNumber,
  formatQuotationNumberForPrinting,
  toPersianDigits,
  type QuotationSequenceScope,
  type QuotationSequenceStore,
} from 'src/domain/quotation/numbering';

const scope: QuotationSequenceScope = {
  documentType: 'QUOTATION',
  fiscalYear: 1403,
  prefix: 'QT',
  width: 6,
};

// An in-memory store that models the ONE property that matters: compare-and-set
// fails when someone else moved the value first.
const createStore = (initial: number | null = null) => {
  let lastIssued = initial;
  let reads = 0;

  const store: QuotationSequenceStore = {
    async readLastIssued() {
      reads += 1;

      return lastIssued;
    },
    async compareAndSetLastIssued(_scopeKey, expected, next) {
      if (expected !== lastIssued) {
        return false;
      }

      lastIssued = next;

      return true;
    },
  };

  return {
    store,
    getLastIssued: () => lastIssued,
    getReadCount: () => reads,
    setLastIssued: (value: number | null) => {
      lastIssued = value;
    },
  };
};

describe('number format', () => {
  it('formats a zero-padded number', () => {
    const result = formatQuotationNumber({ scope, sequence: 123 });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value : '').toBe('QT-1403-000123');
  });

  it('refuses a sequence that would overflow the width', () => {
    const result = formatQuotationNumber({ scope, sequence: 1_000_000 });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.refusal.code).toBe('SEQUENCE_EXCEEDS_WIDTH');
  });

  it('refuses a non-positive sequence', () => {
    expect(formatQuotationNumber({ scope, sequence: 0 }).ok).toBe(false);
    expect(formatQuotationNumber({ scope, sequence: -3 }).ok).toBe(false);
  });

  it('prints with Persian digits', () => {
    const formatted = formatQuotationNumber({ scope, sequence: 123 });

    expect(formatted.ok).toBe(true);
    expect(
      formatQuotationNumberForPrinting(formatted.ok ? formatted.value : ''),
    ).toBe('QT-۱۴۰۳-۰۰۰۱۲۳');
    expect(toPersianDigits('2026-11-18')).toBe('۲۰۲۶-۱۱-۱۸');
  });
});

describe('allocation', () => {
  it('starts at one for a fresh scope', async () => {
    const { store, getLastIssued } = createStore(null);
    const result = await allocateQuotationNumber({ store, scope });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.quotationNumber : '').toBe('QT-1403-000001');
    expect(getLastIssued()).toBe(1);
  });

  it('continues from the last issued number', async () => {
    const { store } = createStore(41);
    const result = await allocateQuotationNumber({ store, scope });

    expect(result.ok ? result.value.sequence : 0).toBe(42);
  });

  it('retries when another issuer wins the compare-and-set', async () => {
    const { store, setLastIssued, getLastIssued } = createStore(10);
    const originalCas = store.compareAndSetLastIssued;
    let casCalls = 0;

    // Simulates a competing writer: the first attempt loses the race because the
    // value moved between read and write.
    store.compareAndSetLastIssued = async (scopeKey, expected, next) => {
      casCalls += 1;

      if (casCalls === 1) {
        setLastIssued(11);

        return false;
      }

      return originalCas(scopeKey, expected, next);
    };

    const result = await allocateQuotationNumber({ store, scope });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.sequence : 0).toBe(12);
    expect(getLastIssued()).toBe(12);
  });

  it('gives up after a bounded number of attempts instead of spinning', async () => {
    const { store } = createStore(5);
    store.compareAndSetLastIssued = async () => false;

    const result = await allocateQuotationNumber({
      store,
      scope,
      maxAttempts: 3,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.refusal.code).toBe('SEQUENCE_CONTENDED');
  });

  it('never hands out the same number twice under contention', async () => {
    // Two allocators interleaved on the same store: every successful allocation must
    // be distinct, which is the property a duplicate would break.
    const { store } = createStore(null);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => allocateQuotationNumber({ store, scope })),
    );

    const sequences = results
      .filter((result) => result.ok)
      .map((result) => (result.ok ? result.value.sequence : -1));

    expect(sequences.length).toBeGreaterThan(0);
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it('keys the scope by document type and fiscal year', () => {
    expect(buildSequenceScopeKey(scope)).toBe('QUOTATION:1403');
    expect(
      buildSequenceScopeKey({ ...scope, fiscalYear: 1404 }),
    ).not.toBe(buildSequenceScopeKey(scope));
  });

  it('does not consume a number when formatting would fail', async () => {
    const { store, getReadCount, getLastIssued } = createStore(999_999);
    const narrowScope: QuotationSequenceScope = { ...scope, width: 6 };

    const result = await allocateQuotationNumber({
      store,
      scope: narrowScope,
    });

    expect(result.ok).toBe(false);
    // One read to discover the value, and no write, so the number stays unconsumed.
    expect(getReadCount()).toBe(1);
    expect(getLastIssued()).toBe(999_999);
  });
});
