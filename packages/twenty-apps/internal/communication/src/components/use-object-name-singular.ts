import { useFrontComponentExecutionContext } from 'twenty-sdk/front-component';

// The `nameSingular` of the object the selected records belong to.
//
// WHY THIS IS LOCAL RATHER THAN AN SDK EXPORT: the app is built against the
// PUBLISHED `twenty-sdk`, whose type surface predates this field. The VALUE comes
// from the HOST (which populates the execution context), so it is present at
// runtime regardless of the SDK version — only the published TYPE does not know
// about it yet. The narrow cast below is therefore about the type lag, not about
// the value being uncertain.
//
// The workspace SDK source does declare it (`useObjectNameSingular`), so once the
// published SDK catches up this file can be replaced by that export and the cast
// deleted. Until then, `twenty-sdk` 2.35.0 is what the build actually resolves.
type ExecutionContextWithObject = {
  objectNameSingular?: string | null;
};

export const useObjectNameSingular = (): string | null => {
  const objectNameSingular = useFrontComponentExecutionContext(
    (context) =>
      (context as unknown as ExecutionContextWithObject).objectNameSingular,
  );

  return typeof objectNameSingular === 'string' && objectNameSingular.length > 0
    ? objectNameSingular
    : null;
};
