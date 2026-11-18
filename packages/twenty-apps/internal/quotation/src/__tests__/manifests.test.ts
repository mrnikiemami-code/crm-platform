import { describe, expect, it } from 'vitest';

import accountingConnection from 'src/objects/accounting-connection.object';
import accountingItemLink from 'src/objects/accounting-item-link.object';
import accountingSyncOperation from 'src/objects/accounting-sync-operation.object';
import catalogItem from 'src/objects/catalog-item.object';
import price from 'src/objects/price.object';
import priceList from 'src/objects/price-list.object';
import quotation from 'src/objects/quotation.object';
import quotationLine from 'src/objects/quotation-line.object';
import quotationRevision from 'src/objects/quotation-revision.object';
import quotationSequence from 'src/objects/quotation-sequence.object';
import applicationConfig from 'src/application.config';
import companyQuotations from 'src/fields/company-quotations.field';
import opportunityQuotations from 'src/fields/opportunity-quotations.field';
import personQuotations from 'src/fields/person-quotations.field';

import { type ValidationResult } from 'twenty-sdk/define';

// The manifests are PROPOSED, not installed: S1 does not create any object in a
// database. Running the SDK's own validator over them is the only check available
// without an install, and it still catches the mistakes that would fail the sync —
// a missing label, a SELECT without options, a label identifier that names no field.
type Manifest = ValidationResult<{ universalIdentifier: string; fields?: { universalIdentifier: string; name: string }[] }>;

const allManifests: { name: string; manifest: Manifest }[] = [
  { name: 'catalogItem', manifest: catalogItem as Manifest },
  { name: 'priceList', manifest: priceList as Manifest },
  { name: 'price', manifest: price as Manifest },
  { name: 'quotation', manifest: quotation as Manifest },
  { name: 'quotationLine', manifest: quotationLine as Manifest },
  { name: 'quotationRevision', manifest: quotationRevision as Manifest },
  { name: 'quotationSequence', manifest: quotationSequence as Manifest },
  { name: 'accountingConnection', manifest: accountingConnection as Manifest },
  { name: 'accountingItemLink', manifest: accountingItemLink as Manifest },
  {
    name: 'accountingSyncOperation',
    manifest: accountingSyncOperation as Manifest,
  },
];

describe('object manifests', () => {
  it.each(allManifests.map(({ name, manifest }) => [name, manifest] as const))(
    '%s validates with no errors',
    (_name, manifest) => {
      expect(manifest.errors).toEqual([]);
      expect(manifest.success).toBe(true);
    },
  );

  it('gives every object and field a unique universal identifier', () => {
    const identifiers: string[] = [];

    for (const { manifest } of allManifests) {
      identifiers.push(manifest.config.universalIdentifier);

      for (const field of manifest.config.fields ?? []) {
        identifiers.push(field.universalIdentifier);
      }
    }

    for (const relationField of [
      personQuotations,
      companyQuotations,
      opportunityQuotations,
    ]) {
      identifiers.push(relationField.config.universalIdentifier);
    }

    // A duplicate identifier would make the platform treat two fields as the same one
    // and silently drop the second.
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('declares a relation on both of its ends', () => {
    const declared = new Map<string, string>();

    for (const { name, manifest } of allManifests) {
      for (const field of manifest.config.fields ?? []) {
        declared.set(field.universalIdentifier, name);
      }
    }

    for (const relationField of [
      personQuotations,
      companyQuotations,
      opportunityQuotations,
    ]) {
      declared.set(relationField.config.universalIdentifier, 'standard object');
    }

    const danglingTargets: string[] = [];

    for (const { manifest } of allManifests) {
      for (const field of manifest.config.fields ?? []) {
        const target = (field as { relationTargetFieldMetadataUniversalIdentifier?: string })
          .relationTargetFieldMetadataUniversalIdentifier;

        if (target !== undefined && !declared.has(target)) {
          danglingTargets.push(`${field.name} -> ${target}`);
        }
      }
    }

    expect(danglingTargets).toEqual([]);
  });

  it('exposes no credential field on a record', () => {
    const secretLookingFieldNames: string[] = [];

    for (const { name, manifest } of allManifests) {
      for (const field of manifest.config.fields ?? []) {
        if (/token|secret|password|apikey|api_key/i.test(field.name)) {
          secretLookingFieldNames.push(`${name}.${field.name}`);
        }
      }
    }

    // Credentials belong in encrypted application variables, which never render in a
    // record, an export or a backup.
    expect(secretLookingFieldNames).toEqual([]);
  });
});

describe('application config', () => {
  it('validates with no errors', () => {
    expect(applicationConfig.errors).toEqual([]);
  });

  it('declares the master outbound switch off by default', () => {
    const outboundSwitch =
      applicationConfig.config.applicationVariables?.ACCOUNTING_OUTBOUND_ENABLED;

    expect(outboundSwitch).toBeDefined();
    // No `value` means no manifest default, so a fresh workspace has it unset and
    // nothing is pushed to an accounting system until someone turns it on.
    expect(
      (outboundSwitch as { value?: unknown } | undefined)?.value,
    ).toBeUndefined();
  });

  it('marks the mock adapter credential secret', () => {
    const credential =
      applicationConfig.config.applicationVariables?.MOCK_ADAPTER_SHARED_SECRET;

    expect((credential as { isSecret?: boolean } | undefined)?.isSecret).toBe(
      true,
    );
  });
});
