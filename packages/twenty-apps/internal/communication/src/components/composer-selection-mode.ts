// The composer's two modes, derived from the host's multi-record selection.
//
// `useSelectedRecordIds()` returns every selected record id; the single-record
// id is simply `ids.length === 1 ? ids[0] : null`. Deriving the mode from that
// one source keeps the single and bulk paths from ever disagreeing about how
// many people were selected.
export type ComposerMode = 'NONE' | 'SINGLE' | 'BULK';

export const resolveComposerMode = (
  selectedRecordIds: string[],
): ComposerMode => {
  if (selectedRecordIds.length === 0) {
    return 'NONE';
  }

  return selectedRecordIds.length === 1 ? 'SINGLE' : 'BULK';
};

// The single-record id used by the existing single-person form. `null` unless
// exactly one record is selected, mirroring the deprecated `useRecordId`.
export const resolveSingleRecordId = (
  selectedRecordIds: string[],
): string | null =>
  selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;
