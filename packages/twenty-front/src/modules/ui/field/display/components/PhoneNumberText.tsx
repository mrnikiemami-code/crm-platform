import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

const StyledPhoneNumberText = styled.span`
  // Isolate the telephone string as LTR so +cc, digits and separators keep
  // reading order inside RTL pages without flipping the surrounding cell.
  direction: ltr;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  unicode-bidi: isolate;
  white-space: nowrap;
`;

type PhoneNumberTextProps = {
  children: ReactNode;
};

export const PhoneNumberText = ({ children }: PhoneNumberTextProps) => {
  if (children === null || children === undefined || children === '') {
    return null;
  }

  return <StyledPhoneNumberText dir="ltr">{children}</StyledPhoneNumberText>;
};
