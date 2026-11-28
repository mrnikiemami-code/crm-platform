// Asan Factor wire fields that CRM quotation/proforma must not invent.
// Guide: proforma does not record serial; header StorageID ignored for proforma;
// VisitorID=0 means none. CRM may keep a human visitor label without mapping to
// a vendor VisitorID until architect confirms an approved identity seam.

export const PROFORMA_UNSUPPORTED_VENDOR_FIELDS = [
  {
    wireField: 'VisitorID',
    reason:
      'CRM visitorName is a label only; no vendor VisitorID is fabricated for proforma',
  },
  {
    wireField: 'StorageID',
    reason:
      'Proforma header StorageID is ignored by guide; warehouse ids are not invented',
  },
  {
    wireField: 'Serial',
    reason:
      'Proforma does not record serial; serials stay read-only catalog observation',
  },
] as const;

export const isProformaVendorFieldSupported = (wireField: string): boolean =>
  !PROFORMA_UNSUPPORTED_VENDOR_FIELDS.some(
    (entry) => entry.wireField === wireField,
  );
