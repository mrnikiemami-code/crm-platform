import { readFileSync } from 'fs';
import { join } from 'path';

const readSource = (relativePath: string) =>
  readFileSync(join(__dirname, relativePath), 'utf8');

const PHYSICAL_INLINE_DECLARATION =
  /^\s*(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/m;

describe('navigation item logical layout', () => {
  it.each([
    '../NavigationMenuItemRowActions.tsx',
    '../../../../ui/navigation/navigation-drawer/components/NavigationDrawerItem.tsx',
  ])('%s does not use physical inline offsets', (relativePath) => {
    expect(readSource(relativePath)).not.toMatch(PHYSICAL_INLINE_DECLARATION);
  });

  it('anchors row actions to the inline end', () => {
    expect(readSource('../NavigationMenuItemRowActions.tsx')).toMatch(
      /inset-inline-end:/,
    );
  });

  it('reserves inline-end space for row actions on the item label', () => {
    const source = readSource('../NavigationMenuItemEditable.tsx');

    expect(source).toMatch(/data-row-actions=\{rowActionsCount\}/);
    expect(source).toMatch(
      /\[data-row-actions='1'\] \.navigation-drawer-item \{\s*padding-inline-end:/,
    );
    expect(source).toMatch(
      /\[data-row-actions='2'\] \.navigation-drawer-item \{\s*padding-inline-end:/,
    );
  });
});
