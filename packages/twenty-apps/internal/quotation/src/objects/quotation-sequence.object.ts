import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  QUOTATION_SEQUENCE_FIELDS,
  QUOTATION_SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The allocator state for quotation numbers, one record per (document type, fiscal
// year) inside a workspace.
//
// WHY A RECORD AND NOT A COUNTER ON THE QUOTATION: allocation needs a single row whose
// uniqueness is enforced by the database, so two concurrent issuers cannot both win.
// `scopeKey` is that row's unique key; the allocator reads `lastIssued`, then writes
// the next value only if the row still holds the value it read.
//
// Never creatable or editable from the UI: a person editing a counter is a way to
// produce a duplicate number.
export default defineObject({
  universalIdentifier: QUOTATION_SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationSequence',
  namePlural: 'quotationSequences',
  labelSingular: 'Quotation sequence',
  labelPlural: 'Quotation sequences',
  description:
    'Allocator state for quotation numbers. One record per document type and fiscal year.',
  icon: 'IconListNumbers',
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_SEQUENCE_FIELDS.scopeKey,
  fields: [
    {
      universalIdentifier: QUOTATION_SEQUENCE_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Human-readable label, for example QUOTATION 1403.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_SEQUENCE_FIELDS.scopeKey,
      type: FieldType.TEXT,
      name: 'scopeKey',
      label: 'Scope key',
      description:
        'Document type and fiscal year, for example QUOTATION:1403. Unique: this is the row the allocator contends on.',
      icon: 'IconKey',
      isNullable: false,
      isUnique: true,
    },
    {
      universalIdentifier: QUOTATION_SEQUENCE_FIELDS.lastIssued,
      type: FieldType.NUMBER,
      name: 'lastIssued',
      label: 'Last issued',
      description:
        'Highest number handed out. The next allocation is this plus one, written only if this value is unchanged.',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: 0,
    },
    {
      universalIdentifier: QUOTATION_SEQUENCE_FIELDS.width,
      type: FieldType.NUMBER,
      name: 'width',
      label: 'Number width',
      description:
        'Zero-padded digits, for example 6 to produce QT-1403-000123. A sequence that overflows the width is refused.',
      icon: 'IconRuler',
      isNullable: false,
      defaultValue: 6,
    },
  ],
});
