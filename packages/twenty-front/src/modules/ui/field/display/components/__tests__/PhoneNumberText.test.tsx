import { render, screen } from '@testing-library/react';

import { PhoneNumberText } from '@/ui/field/display/components/PhoneNumberText';

describe('PhoneNumberText', () => {
  it.each([
    ['+989121234567'],
    ['09121234567'],
    ['+98 912-123-4567'],
  ])('isolates %s as an LTR telephone segment', (value) => {
    render(<PhoneNumberText>{value}</PhoneNumberText>);

    const node = screen.getByText(value);

    expect(node).toHaveAttribute('dir', 'ltr');
    expect(node.tagName).toBe('SPAN');
  });

  it('renders nothing for empty values', () => {
    const { container } = render(<PhoneNumberText>{''}</PhoneNumberText>);

    expect(container).toBeEmptyDOMElement();
  });
});
