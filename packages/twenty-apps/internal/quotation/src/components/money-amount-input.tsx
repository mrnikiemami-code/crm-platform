import {
  type CSSProperties,
  type ChangeEvent,
  useLayoutEffect,
  useRef,
} from 'react';

import { applyMoneyInputChange } from 'src/domain/money/money-input-text';

type MoneyAmountInputProps = {
  value: string;
  onValueChange: (next: string) => void;
  style?: CSSProperties;
  'aria-label'?: string;
};

export const MoneyAmountInput = ({
  value,
  onValueChange,
  style,
  'aria-label': ariaLabel,
}: MoneyAmountInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;

    if (input === null || caret === null) {
      return;
    }

    input.setSelectionRange(caret, caret);
    pendingCaret.current = null;
  }, [value]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const caret = event.target.selectionStart ?? event.target.value.length;
    const next = applyMoneyInputChange({
      nextRawText: event.target.value,
      caretIndex: caret,
    });

    pendingCaret.current = next.caretIndex;
    onValueChange(next.displayText);
  };

  return (
    <input
      ref={inputRef}
      style={style}
      value={value}
      aria-label={ariaLabel}
      inputMode="decimal"
      onChange={onChange}
    />
  );
};
