import { describe, expect, it } from 'vitest';

import accountingConnection from 'src/objects/accounting-connection.object';
import accountingItemLink from 'src/objects/accounting-item-link.object';
import accountingPartyLink from 'src/objects/accounting-party-link.object';
import accountingSyncOperation from 'src/objects/accounting-sync-operation.object';
import catalogItem from 'src/objects/catalog-item.object';
import price from 'src/objects/price.object';
import priceList from 'src/objects/price-list.object';
import quotation from 'src/objects/quotation.object';
import quotationCustomerLink from 'src/objects/quotation-customer-link.object';
import quotationLine from 'src/objects/quotation-line.object';
import quotationRevision from 'src/objects/quotation-revision.object';
import quotationSequence from 'src/objects/quotation-sequence.object';
import quotationShare from 'src/objects/quotation-share.object';
import quotationCurrency from 'src/objects/quotation-currency.object';
import quotationUnit from 'src/objects/quotation-unit.object';
import roundingRule from 'src/objects/rounding-rule.object';
import taxPolicy from 'src/objects/tax-policy.object';
import companyEconomicCode from 'src/fields/company-economic-code.field';
import companyNationalCode from 'src/fields/company-national-code.field';
import personEconomicCode from 'src/fields/person-economic-code.field';
import personNationalCode from 'src/fields/person-national-code.field';
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
  { name: 'quotationCustomerLink', manifest: quotationCustomerLink as Manifest },
  { name: 'quotationShare', manifest: quotationShare as Manifest },
  { name: 'quotationLine', manifest: quotationLine as Manifest },
  { name: 'quotationRevision', manifest: quotationRevision as Manifest },
  { name: 'quotationSequence', manifest: quotationSequence as Manifest },
  { name: 'accountingConnection', manifest: accountingConnection as Manifest },
  { name: 'accountingItemLink', manifest: accountingItemLink as Manifest },
  { name: 'accountingPartyLink', manifest: accountingPartyLink as Manifest },
  {
    name: 'accountingSyncOperation',
    manifest: accountingSyncOperation as Manifest,
  },
];

describe('object manifests', () => {
  it('keeps all current unique TEXT keys compatible with the server index validator', () => {
    type Field = { name: string; type?: string; isUnique?: boolean; isNullable?: boolean; defaultValue?: unknown };
    const fields: Field[] = [
      ...allManifests.flatMap(({ manifest }) => manifest.config.fields ?? []),
      ...[quotationCurrency, quotationUnit, roundingRule, taxPolicy].flatMap((manifest) => (manifest.config.fields ?? []) as Field[]),
      ...[companyEconomicCode, companyNationalCode, personEconomicCode, personNationalCode].map((manifest) => manifest.config as Field),
    ];
    const unique = fields.filter((field) => field.type === 'TEXT' && field.isUnique === true);
    expect(unique.map((field) => field.name).sort()).toEqual(['economicCode', 'economicCode', 'nationalCode', 'nationalCode', 'quotationNumber', 'scopeKey', 'tokenHash']);
    expect(unique.filter((field) => field.defaultValue != null)).toEqual([]);
    for (const name of ['scopeKey', 'tokenHash']) {
      expect(unique.find((field) => field.name === name)).toMatchObject({ isUnique: true, isNullable: false, defaultValue: null });
    }
  });
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
        // tokenHash is a sha256 of a one-time customer token, not a credential.
        if (
          field.name !== 'tokenHash' &&
          /token|secret|password|apikey|api_key/i.test(field.name)
        ) {
          secretLookingFieldNames.push(`${name}.${field.name}`);
        }
      }
    }

    // Credentials belong in encrypted application variables, which never render in a
    // record, an export or a backup.
    expect(secretLookingFieldNames).toEqual([]);
  });

  it('keeps money in exactly ONE lossless column per amount', () => {
    // Architect decision D3: a single authoritative exact representation, no second editable
    // copy. A NUMERIC, NUMBER or CURRENCY money column would be the second copy — and the
    // lossy one, because Twenty's GraphQL BigFloat scalar parses with parseFloat.
    const moneyFieldNames = /(price|amount|total|discount|tax)/i;
    const doubleStoredAmounts: string[] = [];

    for (const { name, manifest } of allManifests) {
      for (const field of manifest.config.fields ?? []) {
        const type = (field as { type?: string }).type;

        if (
          moneyFieldNames.test(field.name) &&
          (type === 'NUMERIC' || type === 'NUMBER' || type === 'CURRENCY')
        ) {
          doubleStoredAmounts.push(`${name}.${field.name} (${type})`);
        }
      }
    }

    expect(doubleStoredAmounts).toEqual([]);
  });

  it('stores every exact amount and quantity as canonical six-decimal text', () => {
    const violations: string[] = [];

    for (const { name, manifest } of allManifests) {
      for (const field of manifest.config.fields ?? []) {
        if (!/Exact$/.test(field.name)) {
          continue;
        }

        const type = (field as { type?: string }).type;
        const defaultValue = (field as { defaultValue?: unknown }).defaultValue;

        if (type !== 'TEXT') {
          violations.push(`${name}.${field.name} is ${type}, expected TEXT`);
          continue;
        }

        // Canonical means six decimals, so a fresh row cannot hold "0" while the domain
        // expects "0.000000". SDK TEXT defaults are quoted as '0.000000' for the platform.
        const unquoted =
          typeof defaultValue === 'string' &&
          defaultValue.length >= 2 &&
          defaultValue.startsWith("'") &&
          defaultValue.endsWith("'")
            ? defaultValue.slice(1, -1)
            : defaultValue;

        if (
          typeof unquoted === 'string' &&
          unquoted !== '' &&
          !/^-?\d+\.\d{6}$/.test(unquoted)
        ) {
          violations.push(
            `${name}.${field.name} default "${defaultValue}" is not six-decimal`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
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
