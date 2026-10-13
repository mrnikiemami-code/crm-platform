import { describe, expect, it } from 'vitest';

import navItem from 'src/navigation-menu-items/message-templates.navigation-menu-item';
import pageLayout from 'src/page-layouts/message-template.page-layout';
import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Locks the W17 §A management surface: a sidebar entry pointing at the EXISTING
// native view (one storage, one view), and a record page that renders the
// variable guide from the same catalog the server evaluates.
const navConfig = navItem.config as unknown as {
  universalIdentifier: string;
  type: string;
  viewUniversalIdentifier?: string;
  targetObjectUniversalIdentifier?: string;
  position: number;
};

const layoutConfig = pageLayout.config as unknown as {
  universalIdentifier: string;
  type: string;
  objectUniversalIdentifier?: string;
  tabs?: {
    title: string;
    widgets?: {
      type: string;
      configuration: { configurationType: string; frontComponentUniversalIdentifier?: string };
    }[];
  }[];
};

describe('message-template management surface (W17 §A)', () => {
  it('exposes a sidebar entry as an OBJECT item (clean label, no suffix)', () => {
    expect(navItem.success).toBe(true);
    expect(navConfig.universalIdentifier).toBe(
      MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
    // OBJECT type: the sidebar renders exactly the object's plural label
    // («الگوهای پیامک»), with NO `· <object>` suffix. W17's VIEW item rendered
    // `<view name> · <object plural>`, which is why it was retired in W17-R1.
    expect(navConfig.type).toBe('OBJECT');
    expect(navConfig.targetObjectUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );
  });

  it('retires the W17 VIEW navigation item with a DIFFERENT identifier', () => {
    // The retired identifier must not collide with the live one, and nothing
    // declares it any more, so the platform's
    // `inferDeletionFromMissingEntities` sync deletes exactly that row.
    expect(
      RETIRED_MESSAGE_TEMPLATES_VIEW_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    ).not.toBe(MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER);
    expect(navConfig.viewUniversalIdentifier).toBeUndefined();
  });

  it('defines a record page for the messageTemplate object', () => {
    expect(pageLayout.success).toBe(true);
    expect(layoutConfig.type).toBe('RECORD_PAGE');
    expect(layoutConfig.objectUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );
  });

  it('includes a fields tab and a large native body editor', () => {
    const fieldsTab = layoutConfig.tabs?.find(
      (tab) => tab.title === 'Fields',
    );
    const messageTab = layoutConfig.tabs?.find(
      (tab) => tab.title === 'Message',
    );

    expect(fieldsTab?.widgets?.[0].configuration.configurationType).toBe(
      'FIELDS',
    );
    expect(messageTab?.widgets?.[0].configuration).toMatchObject({
      configurationType: 'FIELD',
      fieldMetadataId: MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      fieldDisplayMode: 'EDITOR',
    });
  });

  it('renders the variable guide as a front component on the Variables tab', () => {
    const variablesTab = layoutConfig.tabs?.find(
      (tab) => tab.title === 'Variables',
    );

    const guideWidget = variablesTab?.widgets?.find(
      (widget) => widget.type === 'FRONT_COMPONENT',
    );

    expect(guideWidget?.configuration.frontComponentUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    );
  });
});
