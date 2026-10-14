// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  collectFocusCycle,
  focusElementSafely,
  isFocusCapable,
  isInsideContainer,
  readActiveElement,
  setSelectionRangeSafely,
} from 'src/components/studio-dom';

// These helpers exist because the front-component renderer can hand back values
// that are NOT real DOM elements. The live crash
// `Uncaught TypeError: …focus is not a function` came from calling through
// blindly, so every guard below is a regression lock on that failure.

describe('isFocusCapable', () => {
  it('accepts only a value that really exposes focus()', () => {
    expect(isFocusCapable({ focus: () => {} })).toBe(true);
    expect(isFocusCapable({})).toBe(false);
    expect(isFocusCapable({ focus: 'nope' })).toBe(false);
    expect(isFocusCapable(null)).toBe(false);
    expect(isFocusCapable(undefined)).toBe(false);
    expect(isFocusCapable('div')).toBe(false);
    expect(isFocusCapable(42)).toBe(false);
  });
});

describe('focusElementSafely', () => {
  it('focuses a real element and reports success', () => {
    let focused = 0;
    const element = { focus: () => { focused += 1; } };

    expect(focusElementSafely(element)).toBe(true);
    expect(focused).toBe(1);
  });

  it('never throws for a renderer value without focus', () => {
    // This is exactly the shape that crashed the mounted component.
    expect(() => focusElementSafely({ tagName: 'DIV' })).not.toThrow();
    expect(focusElementSafely({ tagName: 'DIV' })).toBe(false);
    expect(focusElementSafely(null)).toBe(false);
    expect(focusElementSafely(undefined)).toBe(false);
  });

  it('swallows a focus implementation that itself throws', () => {
    const element = {
      focus: () => {
        throw new TypeError('focus is not a function');
      },
    };

    expect(() => focusElementSafely(element)).not.toThrow();
    expect(focusElementSafely(element)).toBe(false);
  });
});

describe('setSelectionRangeSafely', () => {
  it('sets the caret on a real element', () => {
    const element = {
      selectionStart: 0 as number | null,
      selectionEnd: 0 as number | null,
      setSelectionRange: (start: number) => {
        element.selectionStart = start;
        element.selectionEnd = start;
      },
    };

    expect(setSelectionRangeSafely(element, 5, 5)).toBe(true);
    expect(element.selectionStart).toBe(5);
  });

  it('never throws for a value without the selection API', () => {
    expect(() => setSelectionRangeSafely({}, 1, 1)).not.toThrow();
    expect(setSelectionRangeSafely(null, 1, 1)).toBe(false);
  });
});

describe('collectFocusCycle', () => {
  const buildContainer = (candidates: unknown[]) => ({
    querySelectorAll: () => ({
      length: candidates.length,
      ...Object.fromEntries(candidates.map((c, i) => [i, c])),
    }),
  });

  it('keeps only focus-capable, enabled values', () => {
    const enabled = { focus: () => {} };
    const disabled = { focus: () => {}, disabled: true };
    const proxy = { tagName: 'INPUT' };

    const cycle = collectFocusCycle(
      buildContainer([enabled, disabled, proxy, null]),
    );

    expect(cycle).toEqual([enabled]);
  });

  it('returns an empty cycle for a container that cannot query', () => {
    expect(collectFocusCycle(null)).toEqual([]);
    expect(collectFocusCycle({})).toEqual([]);
    expect(collectFocusCycle({ querySelectorAll: 'nope' })).toEqual([]);
  });

  it('returns an empty cycle when the query itself throws', () => {
    const container = {
      querySelectorAll: () => {
        throw new Error('boom');
      },
    };

    expect(collectFocusCycle(container)).toEqual([]);
  });

  it('returns an empty cycle when the result is not list-like', () => {
    expect(collectFocusCycle({ querySelectorAll: () => null })).toEqual([]);
    expect(collectFocusCycle({ querySelectorAll: () => ({}) })).toEqual([]);
  });
});

describe('isInsideContainer', () => {
  it('is true only when the container really contains the target', () => {
    const inner = { name: 'inner' };
    const container = {
      contains: (node: unknown) => node === inner,
    };

    expect(isInsideContainer(container, inner)).toBe(true);
    expect(isInsideContainer(container, { name: 'backdrop' })).toBe(false);
  });

  it('is false without a usable contains implementation', () => {
    expect(isInsideContainer(null, {})).toBe(false);
    expect(isInsideContainer({}, {})).toBe(false);
    expect(
      isInsideContainer({ contains: () => { throw new Error('boom'); } }, {}),
    ).toBe(false);
  });
});

describe('readActiveElement', () => {
  it('returns the active element without throwing', () => {
    expect(() => readActiveElement()).not.toThrow();
    expect(readActiveElement()).toBe(document.activeElement ?? null);
  });
});
