import { defineApplicationRole, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_APP_ROLE_UNIVERSAL_IDENTIFIER,
  QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_SHARE_OBJECT_UNIVERSAL_IDENTIFIER,
  TAX_POLICY_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Least-privilege role for quotation logic functions.
//
// Accounting objects are read/update only: the app never destroys a sync row or a link,
// because the ledger is the audit trail of what was sent. The connection record holds no
// credential, so granting update here does not expose a secret.
export default defineApplicationRole({
  universalIdentifier: QUOTATION_APP_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'نقش اپ پیش‌فاکتور',
  description:
    'خواندن شخص/شرکت و کاتالوگ، و ایجاد/ویرایش پیش‌نویس پیش‌فاکتور و ردیف‌ها',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      // Removing a line from a draft is a soft delete; without it a save that
      // drops a row would be refused. Hard destroy stays closed.
      canSoftDeleteObjectRecords: true,
    },
    {
      objectUniversalIdentifier: QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: QUOTATION_SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier:
        QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: QUOTATION_SHARE_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier:
        ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier:
        ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier:
        ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      // The tax settings route reads the catalog and writes policies. There is no
      // destroy permission on purpose: the only removal it offers is deactivation.
      objectUniversalIdentifier: TAX_POLICY_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
  ],
});
