import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import commandMenuItemResult from 'src/command-menu-items/send-message.command-menu-item';
import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import navigationMenuItemResult from 'src/navigation-menu-items/communications.navigation-menu-item';
import objectResult from 'src/objects/communication.object';
import viewResult from 'src/views/communications.view';

// Locks the W13 UX closure on the real production modules:
//  - sending is separated from hand-authoring a record,
//  - records are discoverable through a read-only view + sidebar entry,
//  - the app-owned metadata catalog covers exactly the labels the app ships,
//    so a renamed label cannot silently fall back to English.

const objectConfig = objectResult.config as unknown as {
  isUICreatable?: boolean;
  isUIEditable?: boolean;
};
const viewConfig = viewResult.config as unknown as {
  name: string;
  objectUniversalIdentifier: string;
  fields?: { fieldMetadataUniversalIdentifier: string; isVisible?: boolean }[];
};
const navigationConfig = navigationMenuItemResult.config as unknown as {
  type: string;
  targetObjectUniversalIdentifier?: string;
};
const commandConfig = commandMenuItemResult.config as unknown as {
  label: string;
  shortLabel: string;
};

const catalog = JSON.parse(
  readFileSync(join(process.cwd(), 'locales', 'fa-IR.json'), 'utf8'),
) as Record<string, string | Record<string, string>>;

describe('send is separated from manual record creation (W13)', () => {
  it('does not offer a generic create/edit affordance for the object', () => {
    expect(objectConfig.isUICreatable).toBe(false);
    expect(objectConfig.isUIEditable).toBe(false);
  });

  it('names the Person command after the real capability', () => {
    expect(commandConfig.label).toBe('Send SMS');
    expect(commandConfig.shortLabel).toBe('Send SMS');
  });

  it('translates the command label through the metadata catalog', () => {
    const labels = catalog['commandMenuItem.label'] as Record<string, string>;
    const shortLabels = catalog['commandMenuItem.shortLabel'] as Record<
      string,
      string
    >;

    expect(labels[commandConfig.label]).toBeDefined();
    expect(shortLabels[commandConfig.shortLabel]).toBeDefined();
  });
});

describe('records are discoverable and read-only (W13)', () => {
  it('adds a Communications view on the object', () => {
    expect(viewResult.success).toBe(true);
    expect(viewConfig.objectUniversalIdentifier).toBe(
      COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
    );
    expect(viewResult.config.universalIdentifier).toBe(
      COMMUNICATIONS_VIEW_UNIVERSAL_IDENTIFIER,
    );
  });

  it('shows the fields a reader needs to understand a record', () => {
    const visibleFieldIds = (viewConfig.fields ?? [])
      .filter((field) => field.isVisible !== false)
      .map((field) => field.fieldMetadataUniversalIdentifier);

    // Person, recipient, body, channel, provider, status and a timestamp.
    expect(visibleFieldIds).toContain(
      'b1bfd4a2-4e12-4846-b4c6-61caad242e84',
    );
    expect(visibleFieldIds).toContain(
      '4a3b6c8d-5e72-4f90-ab1c-2d3e4f5a6b7c',
    );
    expect(visibleFieldIds).toContain(
      '532057f8-9d4c-4272-8409-d9fd7bdc08a4',
    );
    expect(visibleFieldIds).toContain(
      'd61fe7c4-ee50-4109-aeab-847db46c2655',
    );
    expect(visibleFieldIds).toContain(
      '3f2a5b7c-4d61-4e8f-9a0b-1c2d3e4f5a6b',
    );
    expect(visibleFieldIds).toContain(
      '4c09f95d-33cf-45a6-8e2e-8e041bea4970',
    );
    expect(visibleFieldIds).toContain(
      '082db93b-888b-49c0-b8e3-54dba0475716',
    );
  });

  it('exposes the object in the sidebar', () => {
    expect(navigationConfig.type).toBe('OBJECT');
    expect(navigationConfig.targetObjectUniversalIdentifier).toBe(
      COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
    );
    expect(navigationMenuItemResult.config.universalIdentifier).toBe(
      COMMUNICATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
    );
  });

  it('uses only valid UUID v4 universal identifiers for the new view fields', () => {
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const field of viewConfig.fields ?? []) {
      expect(
        uuidV4.test(field.fieldMetadataUniversalIdentifier),
        `${field.fieldMetadataUniversalIdentifier} must be a valid UUID v4`,
      ).toBe(true);
    }
  });
});

describe('the metadata catalog covers the shipped labels (W13)', () => {
  const REQUIRED_CONTEXTS = [
    'objectMetadata.labelSingular',
    'objectMetadata.labelPlural',
    'objectMetadata.description',
    'fieldMetadata.label',
    'commandMenuItem.label',
    'commandMenuItem.shortLabel',
    'navigationMenuItem.name',
    'timelineActivityType.label',
    'view.name',
  ];

  it('declares every metadata context the app relies on', () => {
    for (const context of REQUIRED_CONTEXTS) {
      expect(catalog[context], context).toBeDefined();
    }
  });

  it('translates the object and field labels the app ships', () => {
    const fieldLabels = catalog['fieldMetadata.label'] as Record<
      string,
      string
    >;
    const objectSingular = catalog['objectMetadata.labelSingular'] as Record<
      string,
      string
    >;

    expect(objectSingular.Communication).toBe('ارتباط');
    expect(fieldLabels.Channel).toBe('کانال');
    expect(fieldLabels.Recipient).toBe('گیرنده');
    expect(fieldLabels.Status).toBe('وضعیت');
    expect(fieldLabels['Sent at']).toBe('زمان ارسال');
  });

  it('keeps every translation non-empty and Persian', () => {
    const persian = /[\u0600-\u06FF]/;

    const walk = (value: string | Record<string, string>, key: string) => {
      if (typeof value === 'string') {
        expect(value.length, key).toBeGreaterThan(0);
        expect(persian.test(value), `${key} must be Persian`).toBe(true);
        return;
      }

      for (const [message, translation] of Object.entries(value)) {
        expect(translation.length, `${key} ${message}`).toBeGreaterThan(0);
        expect(persian.test(translation), `${key} ${message}`).toBe(true);
      }
    };

    for (const [key, value] of Object.entries(catalog)) {
      walk(value, key);
    }
  });
});
