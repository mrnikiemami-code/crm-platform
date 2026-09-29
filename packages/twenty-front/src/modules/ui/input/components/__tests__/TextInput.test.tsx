import { render, screen } from '@testing-library/react';

import { TextInput } from '@/ui/input/components/TextInput';

const isAfter = (reference: Element, element: Element) =>
  (reference.compareDocumentPosition(element) &
    Node.DOCUMENT_POSITION_FOLLOWING) !==
  0;

describe('TextInput', () => {
  it('renders no error helper without an error', () => {
    const { container } = render(<TextInput value="eventCode" />);

    expect(container.querySelector('[aria-live]')).not.toBeInTheDocument();
  });

  it('renders the error below the input, outside of the input row', () => {
    render(<TextInput value="" error="Technical name is required" />);

    const input = screen.getByRole('textbox');
    const errorHelper = screen
      .getByText('Technical name is required')
      .closest('[aria-live]');

    expect(errorHelper).toHaveAttribute('aria-live', 'polite');
    expect(errorHelper?.contains(input)).toBe(false);
    expect(input.parentElement?.contains(errorHelper as Node)).toBe(false);
    expect(isAfter(input, errorHelper as Element)).toBe(true);
  });

  it('renders label, input and error in reading order', () => {
    render(
      <TextInput
        label="API Name"
        required
        value=""
        error="Technical name is required"
      />,
    );

    const label = screen.getByText('API Name*');
    const input = screen.getByLabelText('API Name*');
    const error = screen.getByText('Technical name is required');

    expect(isAfter(label, input)).toBe(true);
    expect(isAfter(input, error)).toBe(true);
  });

  it('keeps the error in the same place for an LTR input in an RTL page', () => {
    render(
      <div dir="rtl">
        <TextInput
          dir="ltr"
          value="1event"
          error="نام فنی باید با یک حرف انگلیسی آغاز شود."
        />
      </div>,
    );

    const input = screen.getByRole('textbox');
    const errorHelper = screen
      .getByText('نام فنی باید با یک حرف انگلیسی آغاز شود.')
      .closest('[aria-live]');

    expect(input).toHaveAttribute('dir', 'ltr');
    expect(errorHelper).not.toHaveAttribute('dir');
    expect(input.parentElement?.contains(errorHelper as Node)).toBe(false);
    expect(isAfter(input, errorHelper as Element)).toBe(true);
  });

  it('hides the error helper when noErrorHelper is set', () => {
    render(
      <TextInput value="" error="Technical name is required" noErrorHelper />,
    );

    expect(
      screen.queryByText('Technical name is required'),
    ).not.toBeInTheDocument();
  });
});
