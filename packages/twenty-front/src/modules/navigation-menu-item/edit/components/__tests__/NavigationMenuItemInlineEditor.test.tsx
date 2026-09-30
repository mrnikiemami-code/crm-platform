import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { useContext, useEffect, type ReactNode, type RefObject } from 'react';
import { NavigationMenuItemType } from 'twenty-shared/types';

import { navigationMenuItemIdToRenameState } from '@/navigation-menu-item/common/states/navigationMenuItemIdToRenameState';
import { selectedNavigationMenuItemIdInEditModeState } from '@/navigation-menu-item/common/states/selectedNavigationMenuItemIdInEditModeState';
import { NavigationMenuItemInlineEditor } from '@/navigation-menu-item/edit/components/NavigationMenuItemInlineEditor';
import { NavigationDrawerItemEditingContext } from '@/ui/navigation/navigation-drawer/contexts/NavigationDrawerItemEditingContext';
import { type NavigationMenuItem } from '~/generated-metadata/graphql';

const mockUpdateItem = jest.fn();

jest.mock(
  '@/navigation-menu-item/edit/hooks/useNavigationMenuItemEditController',
  () => ({
    useNavigationMenuItemEditController: () => ({
      updateItem: mockUpdateItem,
    }),
  }),
);

jest.mock('@/navigation/hooks/useIsNavigationDrawerContentExpanded', () => ({
  useIsNavigationDrawerContentExpanded: () => true,
}));

jest.mock('@/ui/input/components/IconPicker', () => ({
  IconPicker: ({ clickableComponent }: { clickableComponent: ReactNode }) =>
    clickableComponent,
}));

jest.mock(
  '@/navigation-menu-item/edit/effect-components/NavigationMenuItemNameInputFocusEffect',
  () => ({ NavigationMenuItemNameInputFocusEffect: () => null }),
);

jest.mock(
  '@/object-record/record-field/ui/meta-types/input/hooks/useRegisterInputEvents',
  () => ({
    useRegisterInputEvents: ({
      inputRef,
      inputValue,
      onEnter,
      onEscape,
    }: {
      inputRef: RefObject<HTMLInputElement>;
      inputValue: string;
      onEnter?: (value: string) => void;
      onEscape?: (value: string) => void;
    }) => {
      // oxlint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        const input = inputRef.current;
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            onEnter?.(inputValue);
          }
          if (event.key === 'Escape') {
            onEscape?.(inputValue);
          }
        };
        input?.addEventListener('keydown', handleKeyDown);
        return () => input?.removeEventListener('keydown', handleKeyDown);
      }, [inputRef, inputValue, onEnter, onEscape]);
    },
  }),
);

const folder = {
  id: 'folder-1',
  type: NavigationMenuItemType.FOLDER,
  name: 'پوشه جدید',
  userWorkspaceId: null,
} as unknown as NavigationMenuItem;

const EditingSlots = () => {
  const editing = useContext(NavigationDrawerItemEditingContext);

  return (
    <div className="navigation-drawer-item">
      <span data-testid="icon-slot">{editing?.icon}</span>
      <span data-testid="label-slot">{editing?.label}</span>
    </div>
  );
};

const renderEditor = ({ renaming }: { renaming: boolean }) => {
  const store = createStore();
  store.set(selectedNavigationMenuItemIdInEditModeState.atom, folder.id);
  if (renaming) {
    store.set(navigationMenuItemIdToRenameState.atom, folder.id);
  }
  const onParentShortcut = jest.fn();

  render(
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <div
          onKeyDown={(event) => {
            if (event.defaultPrevented) {
              onParentShortcut();
            }
          }}
        >
          <NavigationMenuItemInlineEditor
            item={folder}
            dropdownId="navigation-item-folder-1"
            rowAnchorId="navigation-item-anchor-folder-1"
            onEditLink={jest.fn()}
          >
            <EditingSlots />
          </NavigationMenuItemInlineEditor>
        </div>
      </Provider>
    </I18nProvider>,
  );

  return { onParentShortcut };
};

describe('NavigationMenuItemInlineEditor', () => {
  beforeEach(() => {
    mockUpdateItem.mockReset();
  });

  it('keeps internal spaces while typing a folder name', async () => {
    const user = userEvent.setup();
    renderEditor({ renaming: true });
    const input = screen.getByRole('textbox');

    await user.clear(input);
    await user.type(input, 'اطلاعات مشترک');

    expect(input).toHaveValue('اطلاعات مشترک');
  });

  it('does not prevent the Space key inside the name input', () => {
    const { onParentShortcut } = renderEditor({ renaming: true });
    const input = screen.getByRole('textbox');

    const notPrevented = fireEvent.keyDown(input, { key: ' ', code: 'Space' });

    expect(notPrevented).toBe(true);
    expect(onParentShortcut).not.toHaveBeenCalled();
  });

  it('commits the name with internal spaces preserved and outer spaces trimmed', async () => {
    const user = userEvent.setup();
    renderEditor({ renaming: true });
    const input = screen.getByRole('textbox');

    await user.clear(input);
    await user.type(input, '  اطلاعات مشترک  ');
    expect(input).toHaveValue('  اطلاعات مشترک  ');
    await user.keyboard('{Enter}');

    expect(mockUpdateItem).toHaveBeenCalledWith(folder.id, {
      name: 'اطلاعات مشترک',
    });
  });

  it('commits an English name with spaces unchanged', async () => {
    const user = userEvent.setup();
    renderEditor({ renaming: true });
    const input = screen.getByRole('textbox');

    await user.clear(input);
    await user.type(input, 'Shared info');
    await user.keyboard('{Enter}');

    expect(mockUpdateItem).toHaveBeenCalledWith(folder.id, {
      name: 'Shared info',
    });
  });

  it('renders the name input and the label in the same shared label slot', () => {
    renderEditor({ renaming: true });
    expect(screen.getByTestId('label-slot')).toContainElement(
      screen.getByRole('textbox'),
    );
    expect(
      screen.getByTestId('icon-slot').querySelector('button'),
    ).not.toBeNull();
  });

  it('keeps the icon/color control operable in display state', async () => {
    renderEditor({ renaming: false });
    expect(
      screen.getByRole('button', { name: 'Choose icon and color' }),
    ).toBeEnabled();
    expect(screen.getByTestId('label-slot')).toHaveTextContent('پوشه جدید');
  });
});
