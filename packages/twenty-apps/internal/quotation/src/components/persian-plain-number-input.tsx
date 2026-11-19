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
import {
  digitCountBeforeIndex,
  restoreCaretAfterDigitCount,
  toAsciiDigits,
  toPersianDigits,
} from 'src/domain/money/money-input-text';

// Quantity / percent: Persian digits, no money thousands grouping.
type PersianPlainNumberInputProps = {
  value: string;
  onValueChange: (next: string) => void;
  style?: CSSProperties;
  'aria-label'?: string;
};

const formatPlain = (raw: string): string => {
  const ascii = toAsciiDigits(raw)
    .replace(/[\u066c\u060c,'\u00a0\u202f\s]/g, '')
    .replace(/\u066b/g, '.');

  // Keep at most one decimal point while typing.
  const firstDot = ascii.indexOf('.');
  const cleaned =
    firstDot < 0
      ? ascii.replace(/[^\d]/g, '')
      : `${ascii.slice(0, firstDot).replace(/[^\d]/g, '')}.${ascii
          .slice(firstDot + 1)
          .replace(/[^\d.]/g, '')
          .replace(/\./g, '')}`;

  const withPersianDot = cleaned.replace(/\./g, '\u066b');

  return toPersianDigits(withPersianDot);
};

export const PersianPlainNumberInput = ({
  value,
  onValueChange,
  style,
  'aria-label': ariaLabel,
}: PersianPlainNumberInputProps) => {
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
    const digitsBefore = digitCountBeforeIndex(event.target.value, caret);
    const displayText = formatPlain(event.target.value);

    pendingCaret.current = restoreCaretAfterDigitCount(
      displayText,
      digitsBefore,
    );
    onValueChange(displayText);
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
