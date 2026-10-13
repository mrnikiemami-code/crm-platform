import { describe, expect, it } from 'vitest';

import navItem from 'src/navigation-menu-items/message-templates.navigation-menu-item';
import pageLayout from 'src/page-layouts/message-template.page-layout';
import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
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
  it('exposes a sidebar entry pointing at the existing native view', () => {
    expect(navItem.success).toBe(true);
    expect(navConfig.universalIdentifier).toBe(
      MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
    // VIEW type — the original W15-A type, kept because the platform's sync
    // cannot change an existing navigation menu item's type. It points at the
    // SAME view the composer reads; the view is named «الگوهای پیامک».
    expect(navConfig.type).toBe('VIEW');
    expect(navConfig.viewUniversalIdentifier).toBe(
      MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
    );
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
