import { describe, expect, it, vi } from 'vitest';

import {
  readInputCaretIndex,
  restoreInputCaret,
} from 'src/components/front-component-input-caret';

describe('front-component-input-caret', () => {
  it('falls back to end of value when selectionStart is unavailable', () => {
    expect(readInputCaretIndex({ value: '۱۲۳' })).toBe(3);
    expect(readInputCaretIndex({ value: '۱۲۳', selectionStart: null })).toBe(3);
    expect(readInputCaretIndex({ value: '۱۲۳', selectionStart: 1 })).toBe(1);
  });

  it('does not throw when setSelectionRange is missing (FC polyfill)', () => {
    expect(() => restoreInputCaret({} as never, 2)).not.toThrow();
    expect(() => restoreInputCaret(null, 2)).not.toThrow();
  });

  it('calls setSelectionRange when the host implements it', () => {
    const setSelectionRange = vi.fn();

    restoreInputCaret({ setSelectionRange }, 4);

    expect(setSelectionRange).toHaveBeenCalledWith(4, 4);
  });

  it('swallows host rejection from setSelectionRange', () => {
    expect(() =>
      restoreInputCaret(
        {
          setSelectionRange: () => {
            throw new Error('not supported');
          },
        },
        1,
      ),
    ).not.toThrow();
  });
});
