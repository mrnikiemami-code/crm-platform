// Metadata labels are translated by the server at read time, so cached
// collections must be refetched when that translation logic changes.
// Bump this whenever the server starts localizing metadata differently.
export const METADATA_LOCALIZATION_VERSION = 2;
