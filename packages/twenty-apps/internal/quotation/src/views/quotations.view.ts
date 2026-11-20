import { defineView, ViewType } from 'twenty-sdk/define';

import {
  QUOTATION_FIELDS,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATIONS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Default table for پیش‌فاکتورها.
//
// The visible columns answer the four questions an operator asks of a list:
// which document, which customer, what state, how much. Raw storage columns
// (quotationNumber, totalExact, customerType, version) stay in the view as hidden
// fields so sorting, filters and the optimistic-lock token are untouched.
export default defineView({
  universalIdentifier: QUOTATIONS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'همهٔ پیش‌فاکتورها',
  objectUniversalIdentifier: QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconFileInvoice',
  position: 0,
  fields: [
    {
      universalIdentifier: '2020b0b0-0001-4000-8000-000000000001',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.name,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: '2020b0b0-0007-4000-8000-000000000007',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.quotationNumberLabel,
      position: 1,
      isVisible: true,
      size: 170,
    },
    {
      universalIdentifier: '2020b0b0-0008-4000-8000-000000000008',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.customerName,
      position: 2,
      isVisible: true,
      size: 220,
    },
    {
      universalIdentifier: '2020b0b0-0003-4000-8000-000000000003',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.status,
      position: 3,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: '2020b0b0-0009-4000-8000-000000000009',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.totalDisplay,
      position: 4,
      isVisible: true,
      size: 190,
    },
    {
      universalIdentifier: '2020b0b0-0002-4000-8000-000000000002',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.quotationNumber,
      position: 5,
      isVisible: false,
      size: 140,
    },
    {
      universalIdentifier: '2020b0b0-0004-4000-8000-000000000004',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.customerType,
      position: 6,
      isVisible: false,
      size: 100,
    },
    {
      universalIdentifier: '2020b0b0-0005-4000-8000-000000000005',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.totalExact,
      position: 7,
      isVisible: false,
      size: 160,
    },
    {
      universalIdentifier: '2020b0b0-0006-4000-8000-000000000006',
      fieldMetadataUniversalIdentifier: QUOTATION_FIELDS.version,
      position: 8,
      isVisible: false,
      size: 80,
    },
  ],
});
