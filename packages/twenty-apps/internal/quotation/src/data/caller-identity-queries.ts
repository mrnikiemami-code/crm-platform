// `currentUser` lives in the metadata schema and is guarded by user auth: an
// application-only token gets `null`, which is how the caller tells "a person made
// this request" apart from "the app did".
export const buildCurrentUserPermissionFlagsQuery = (): string =>
  'query TaxSettingsCaller { currentUser { currentUserWorkspace { permissionFlags } } }';
