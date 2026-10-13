import { describe, expect, it } from 'vitest';

import studioNavItem from 'src/navigation-menu-items/sms-template-studio.navigation-menu-item';
import studioPageLayout from 'src/page-layouts/sms-template-studio.page-layout';
import pageLayout from 'src/page-layouts/message-template.page-layout';
import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  RETIRED_MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Locks the template-management surface across its revisions:
//  - W17-R1 retired W17's VIEW item in favour of an OBJECT item;
//  - W18-A retires that OBJECT item in favour of a PAGE_LAYOUT item pointing at
//    the dedicated SMS Template Studio.
// The platform cannot change an existing navigation item's TYPE, so each
// revision introduces a NEW identifier and drops the previous one.
const studioNavConfig = studioNavItem.config as unknown as {
  universalIdentifier: string;
  name?: string;
  type: string;
  pageLayoutUniversalIdentifier?: string;
  position: number;
};

const studioLayoutConfig = studioPageLayout.config as unknown as {
  universalIdentifier: string;
  name: string;
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

describe('template studio navigation (W18-A)', () => {
  it('exposes a PAGE_LAYOUT sidebar entry named exactly «الگوهای پیامک»', () => {
    expect(studioNavItem.success).toBe(true);
    expect(studioNavConfig.universalIdentifier).toBe(
      SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
    expect(studioNavConfig.type).toBe('PAGE_LAYOUT');
    expect(studioNavConfig.name).toBe('الگوهای پیامک');
    expect(studioNavConfig.pageLayoutUniversalIdentifier).toBe(
      SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
    );
  });

  it('retires the W17-R1 OBJECT item and the W17 VIEW item with distinct identifiers', () => {
    // Neither retired identifier may collide with the live one, and nothing
    // declares them any more, so the platform's
    // `inferDeletionFromMissingEntities` sync deletes exactly those rows.
    expect(RETIRED_MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER).not.toBe(
      SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
    expect(
      RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    ).not.toBe(SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER);
    // The retired OBJECT item must not carry a target object any more: it is
    // gone, not repurposed.
    expect(studioNavConfig.pageLayoutUniversalIdentifier).not.toBe(
      RETIRED_MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
  });
});

describe('template studio page (W18-A)', () => {
  it('is an app-owned STANDALONE_PAGE with a studio front component widget', () => {
    expect(studioPageLayout.success).toBe(true);
    expect(studioLayoutConfig.type).toBe('STANDALONE_PAGE');
    expect(studioLayoutConfig.objectUniversalIdentifier).toBeUndefined();

    const widget = studioLayoutConfig.tabs?.[0]?.widgets?.[0];

    expect(widget?.type).toBe('FRONT_COMPONENT');
    expect(widget?.configuration.frontComponentUniversalIdentifier).toBe(
      SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    );
  });
});

describe('message-template record page (W17)', () => {
  it('still renders the variable guide on its own record page', () => {
    expect(pageLayout.success).toBe(true);
    expect(recordPageConfig.type).toBe('RECORD_PAGE');
    expect(recordPageConfig.objectUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );

    const bodyTab = recordPageConfig.tabs?.find(
      (tab) => tab.title === 'Message',
    );

    expect(bodyTab?.widgets?.[0].configuration).toMatchObject({
      configurationType: 'FIELD',
      fieldMetadataId: MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
    });

    const variablesTab = recordPageConfig.tabs?.find(
      (tab) => tab.title === 'Variables',
    );

    expect(
      variablesTab?.widgets?.[0].configuration.frontComponentUniversalIdentifier,
    ).toBe(MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER);
  });
});
