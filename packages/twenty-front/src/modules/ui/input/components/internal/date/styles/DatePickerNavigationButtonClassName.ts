import { css } from '@linaria/core';

// Previous/next chevrons point toward inline-start/end, so they mirror in RTL.
// The button is symmetric, so mirroring it as a whole only flips the icon.
export const DATE_PICKER_NAVIGATION_BUTTON_CLASS_NAME = css`
  &:dir(rtl) {
    transform: scaleX(-1);
  }
`;
