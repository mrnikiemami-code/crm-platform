import { renderHook } from '@testing-library/react';

import { useSettingsNavigationItems } from '@/settings/hooks/useSettingsNavigationItems';

const mockNavigateToHelpCenter = jest.fn();

jest.mock('@/support/utils/navigateToHelpCenter', () => ({
  navigateToHelpCenter: () => mockNavigateToHelpCenter(),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
}));

jest.mock('@/settings/roles/hooks/usePermissionFlagMap', () => ({
  usePermissionFlagMap: () => ({}),
}));

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: () => undefined,
}));

// BI-01 review R4: the real settings menu entry, not a source attribute.
// The menu item must do a same-origin document navigation into `/help`.
describe('settings navigation — Help entry', () => {
  beforeEach(() => {
    mockNavigateToHelpCenter.mockReset();
  });

  it('opens the in-app help centre from the menu item', () => {
    const sections = renderHook(() => useSettingsNavigationItems()).result
      .current;

    const documentationItem = sections
      .flatMap((section) => section.items)
      .find((item) => item.label === 'Documentation');

    expect(documentationItem).toBeDefined();
    expect(documentationItem?.path).toBeUndefined();

    documentationItem?.onClick?.();

    expect(mockNavigateToHelpCenter).toHaveBeenCalledTimes(1);
  });
});
