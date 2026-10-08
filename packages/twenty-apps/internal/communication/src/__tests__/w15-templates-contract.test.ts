import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import objectResult from 'src/objects/message-template.object';
import viewResult from 'src/views/message-templates.view';
import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { TEMPLATE_VARIABLES } from 'src/templates/template-variable-catalog';

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

  it('declares exactly title, body and channel fields', () => {
    const fieldNames = objectConfig.fields.map((field) => field.name);

    expect(fieldNames).toEqual(['title', 'body', 'channel']);
    expect(objectConfig.fields.map((field) => field.universalIdentifier)).toEqual(
      [
        MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
        MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
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
    expect(
      viewConfig.fields?.map((field) => field.fieldMetadataUniversalIdentifier),
    ).toEqual([
      MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
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
});

describe('the template variable catalog is explicit and closed (W15-A)', () => {
  it('offers exactly the standard variables, with @name and @company mapped explicitly', () => {
    expect(TEMPLATE_VARIABLES.map((variable) => variable.token)).toEqual([
      'name',
      'lastName',
      'fullName',
      'company',
    ]);
  });

  it('translates every variable picker label in the front-component catalog', () => {
    for (const variable of TEMPLATE_VARIABLES) {
      const translation = catalog[variable.label];

      expect(
        typeof translation === 'string' && translation.length > 0,
        variable.label,
      ).toBe(true);
    }

    expect(catalog['First name']).toBe('نام');
    expect(catalog['Last name']).toBe('نام خانوادگی');
    expect(catalog['Full name']).toBe('نام کامل');
    expect(catalog['Company']).toBe('شرکت');
  });
});
