import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import objectResult from 'src/objects/message-template.object';
import navigationItemResult from 'src/navigation-menu-items/sms-templates.navigation-menu-item';
import viewResult from 'src/views/message-templates.view';
import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_RECIPIENT_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_RECIPIENT_RELATION_UID_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_SOURCE_OBJECT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_SOURCE_OBJECT_UID_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TARGET_OBJECT_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildTemplateCatalogFromMetadata } from 'src/templates/build-template-catalog';
import { findTemplateVariable } from 'src/templates/template-variable-catalog';
import {
  fixtureCatalogTokens,
  templateMetadataObjects,
  unrestrictedPermissions,
  PERSON_CATALOG_SOURCE,
} from 'src/templates/__tests__/catalog-fixture';
// Locks the W15-A template contract on the real production modules:
//  - templates are a NATIVE app object (no parallel storage),
//  - the object is hand-authored through the generic UI (workspace CRUD),
//  - the view is a discoverable, additional workspace surface,
//  - the variable catalog is explicit and closed.

const objectConfig = objectResult.config as unknown as {
  universalIdentifier: string;
  nameSingular: string;
  namePlural: string;
  isUICreatable?: boolean;
  isUIEditable?: boolean;
  fields: { universalIdentifier: string; name: string; type: string }[];
  labelIdentifierFieldMetadataUniversalIdentifier: string;
};

const viewConfig = viewResult.config as unknown as {
  universalIdentifier: string;
  name: string;
  objectUniversalIdentifier: string;
  fields?: { fieldMetadataUniversalIdentifier: string }[];
};

const navigationItemConfig = navigationItemResult.config as unknown as {
  type: string;
  viewUniversalIdentifier?: string;
  pageLayoutUniversalIdentifier?: string;
};

const APP_ROOT = join(__dirname, '..', '..');

const catalog = JSON.parse(
  readFileSync(join(APP_ROOT, 'locales', 'fa-IR.json'), 'utf8'),
) as Record<string, string | Record<string, string>>;

describe('message templates are a native, workspace-owned object (W15-A)', () => {
  it('defines the object with a stable universal identifier', () => {
    expect(objectResult.success).toBe(true);
    expect(objectConfig.universalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );
    expect(objectConfig.nameSingular).toBe('messageTemplate');
    expect(objectConfig.namePlural).toBe('messageTemplates');
  });

  it('uses the generic UI as the supported CRUD path (no parallel storage)', () => {
    expect(objectConfig.isUICreatable).toBe(true);
    expect(objectConfig.isUIEditable).toBe(true);
  });

  it('declares the template fields, including the source model', () => {
    const fieldNames = objectConfig.fields.map((field) => field.name);

    expect(fieldNames).toEqual([
      'title',
      'body',
      'channel',
      'targetObject',
      // Readable, non-authoritative hints, kept for diagnosis.
      'sourceObjectName',
      'recipientRelation',
      // The STABLE identifiers that are actually authoritative: metadata
      // universal identifiers, because a name is a label an operator can rename.
      'sourceObjectUid',
      'recipientRelationUid',
    ]);
    expect(objectConfig.fields.map((field) => field.universalIdentifier)).toEqual(
      [
        MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_TARGET_OBJECT_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_SOURCE_OBJECT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_RECIPIENT_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_SOURCE_OBJECT_UID_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_RECIPIENT_RELATION_UID_FIELD_UNIVERSAL_IDENTIFIER,
      ],
    );
    expect(
      objectConfig.labelIdentifierFieldMetadataUniversalIdentifier,
    ).toBe(MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER);
  });

  it('exposes the templates in a discoverable view', () => {
    expect(viewResult.success).toBe(true);
    expect(viewConfig.universalIdentifier).toBe(
      MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
    );
    expect(viewConfig.objectUniversalIdentifier).toBe(
      MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    );
    // The list shows the source entity and the last change alongside the title,
    // which are the three columns a template manager reads.
    expect(
      viewConfig.fields?.map((field) => field.fieldMetadataUniversalIdentifier),
    ).toEqual([
      MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      MESSAGE_TEMPLATE_TARGET_OBJECT_FIELD_UNIVERSAL_IDENTIFIER,
      MESSAGE_TEMPLATE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
    ]);
  });

  it('uses only valid UUID v4 universal identifiers', () => {
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuidV4.test(objectConfig.universalIdentifier)).toBe(true);

    for (const field of objectConfig.fields) {
      expect(
        uuidV4.test(field.universalIdentifier),
        field.universalIdentifier,
      ).toBe(true);
    }
  });

  it('opens the native templates list from the sidebar, not a bespoke page', () => {
    // The «الگوهای پیامک» entry must open the PLATFORM's list for this object, so
    // the platform supplies the table, the column header menu, search, filter,
    // sort and the record create/edit/delete flow. A PAGE_LAYOUT item would mean
    // the app is drawing that surface itself again, which is exactly what this
    // contract forbids.
    expect(navigationItemConfig.type).toBe('VIEW');
    expect(navigationItemConfig.viewUniversalIdentifier).toBe(
      MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
    );
    expect(navigationItemConfig.pageLayoutUniversalIdentifier).toBeUndefined();

    // The label is the VIEW's own name, so the sidebar copy stays the view's.
    // The view is named «همهٔ الگوها» so the sidebar does not repeat the object name.
    expect(viewConfig.name).toBe('All templates');
  });
});

describe('the template variable catalog is runtime and permission-aware (W17/W17-R1)', () => {
  it('derives its entries from workspace metadata, namespaced to their record', () => {
    // No static list any more: the catalog is assembled from the workspace's
    // object/field metadata (see `build-template-catalog.ts`), so this contract
    // locks the SHAPE rather than a hard-coded field set.
    const catalog = buildTemplateCatalogFromMetadata({
      objects: templateMetadataObjects,
      permissions: unrestrictedPermissions,
      source: PERSON_CATALOG_SOURCE,
    });

    expect(catalog.variables.map((variable) => variable.token)).toEqual([
      ...fixtureCatalogTokens,
    ]);

    for (const variable of catalog.variables) {
      expect(variable.objectName === 'person' || variable.objectName === 'company').toBe(true);
      expect(typeof variable.fieldName).toBe('string');
      expect(variable.fieldName.length).toBeGreaterThan(0);
    }
  });

  it('keeps the six legacy aliases resolving to the same definitions', () => {
    const catalog = buildTemplateCatalogFromMetadata({
      objects: templateMetadataObjects,
      permissions: unrestrictedPermissions,
      source: PERSON_CATALOG_SOURCE,
    });

    const aliases: [string, string][] = [
      ['name', 'person.firstName'],
      ['firstName', 'person.firstName'],
      ['lastName', 'person.lastName'],
      ['fullName', 'person.fullName'],
      ['company', 'company.name'],
      ['companyName', 'company.name'],
    ];

    for (const [alias, canonical] of aliases) {
      expect(findTemplateVariable(catalog, alias)?.token).toBe(canonical);
    }
  });

  it('translates every variable picker label in the front-component catalog', () => {
    // The labels for the FULL_NAME subfields and the Company name are FIXED
    // source strings (so they translate); other labels come from the field's own
    // workspace label.
    expect(catalog['First name']).toBe('نام');
    expect(catalog['Last name']).toBe('نام خانوادگی');
    expect(catalog['Full name']).toBe('نام کامل');
    expect(catalog['Company name']).toBe('نام شرکت');
  });
});
