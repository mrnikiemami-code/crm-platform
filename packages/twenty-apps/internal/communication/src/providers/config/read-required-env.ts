// Reads a required value from the function runtime environment, treating an
// empty string as unset.
export const readRequiredEnv = (name: string): string | undefined => {
  const value = process.env[name];

  return value === undefined || value.length === 0 ? undefined : value;
};

// Builds the standard "not configured" message for a set of missing variable
// names. It lists only names — never values.
export const buildMissingConfigError = (
  providerLabel: string,
  missingVariableNames: string[],
): string =>
  `${providerLabel} is not configured. Set the following application variable(s): ${missingVariableNames.join(', ')}.`;
