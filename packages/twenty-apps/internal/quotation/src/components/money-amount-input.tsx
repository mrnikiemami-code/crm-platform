import {
  type CSSProperties,
  type ChangeEvent,
  useLayoutEffect,
  useRef,
} from 'react';

import {
  readInputCaretIndex,
  restoreInputCaret,
} from 'src/components/front-component-input-caret';
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
    const caret = pendingCaret.current;

    if (caret === null) {
      return;
    }

    restoreInputCaret(inputRef.current, caret);
    pendingCaret.current = null;
  }, [value]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const caret = readInputCaretIndex(event.target);
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
