import { describe, expect, it } from 'vitest';

import nativeNavItem from 'src/navigation-menu-items/sms-templates.navigation-menu-item';
import pageLayout from 'src/page-layouts/message-template.page-layout';
import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  RETIRED_MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Locks the template-management surface across its revisions:
//  - W17-R1 retired W17's VIEW item in favour of an OBJECT item;
//  - W18-A retires that OBJECT item in favour of a PAGE_LAYOUT item pointing at
//    the dedicated SMS Template Studio;
//  - the native-flow revision retires the STUDIO in favour of a VIEW item that
//    opens the platform's own list for the object.
// The platform cannot change an existing navigation item's TYPE, so each
// revision introduces a NEW identifier and drops the previous one.
const nativeNavConfig = nativeNavItem.config as unknown as {
  universalIdentifier: string;
  name?: string;
  type: string;
  viewUniversalIdentifier?: string;
  pageLayoutUniversalIdentifier?: string;
  position: number;
};

const recordPageConfig = pageLayout.config as unknown as {
  universalIdentifier: string;
  type: string;
  objectUniversalIdentifier?: string;
  tabs?: {
    title: string;
    widgets?: {
      type: string;
      configuration: {
        configurationType: string;
        frontComponentUniversalIdentifier?: string;
      };
    }[];
  }[];
};

describe('template management sidebar entry (native flow)', () => {
  it('opens the platform list for the object instead of a bespoke page', () => {
    // The requirement is that template management behaves like the native
    // Companies page: the platform owns the table, the column header menu,
    // search, filter, sort and the record create/edit/delete flow. A VIEW item
    // does exactly that; a PAGE_LAYOUT item would mean the app draws the surface
    // itself, which is the failure this revision removes.
    expect(nativeNavItem.success).toBe(true);
    expect(nativeNavConfig.universalIdentifier).toBe(
      MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
    expect(nativeNavConfig.type).toBe('VIEW');
    expect(nativeNavConfig.viewUniversalIdentifier).toBe(
      MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
    );
    // No page layout, and no `name` that could shadow the view's own label: the
    // sidebar renders `view.name`, which the app catalog translates to
    // «الگوهای پیامک».
    expect(nativeNavConfig.pageLayoutUniversalIdentifier).toBeUndefined();
    expect(nativeNavConfig.name).toBeUndefined();
  });

  it('keeps every retired identifier distinct from the live one', () => {
    // Nothing declares these any more, so the platform's
    // `inferDeletionFromMissingEntities` sync deletes exactly those rows — and
    // the studio page goes with them.
    for (const retired of [
      RETIRED_MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
      RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
      SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    ]) {
      expect(retired).not.toBe(
        MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
      );
    }

    expect(SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER).not.toBe(
      MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
    );
  });
});

describe('message-template record page (W17)', () => {
  it('renders the template editor as the record page, with no raw field list', () => {
    expect(pageLayout.success).toBe(true);
    expect(recordPageConfig.type).toBe('RECORD_PAGE');
    expect(recordPageConfig.objectUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );

    // The editor owns the whole flow, so the page declares exactly one tab.
    expect(recordPageConfig.tabs).toHaveLength(1);

    const editorTab = recordPageConfig.tabs?.find(
      (tab) => tab.title === 'ویرایشگر',
    );
    const widget = editorTab?.widgets?.[0];

    expect(widget?.type).toBe('FRONT_COMPONENT');
    expect(
      widget?.configuration.frontComponentUniversalIdentifier,
    ).toBe(MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER);

    // A `FIELDS` widget renders every field, which leaked the technical
    // identifiers, the relation API name and the engine `name` field into the
    // normal form. It must not come back.
    for (const tab of recordPageConfig.tabs ?? []) {
      for (const declaredWidget of tab.widgets ?? []) {
        expect(declaredWidget.type).not.toBe('FIELDS');
      }
    }
  });
});
