// The shapes and parsers for the ELIGIBLE SOURCES response, shared by the
// template editor and the send composer.
//
// They live outside either component because both need the same identity model:
// a source is identified by the metadata `universalIdentifier` of its object and
// of its relation field. Names are display-only hints resolved server-side from
// metadata, never identity.

export type SourceRelation = {
  relationUid: string;
  relationName: string;
  relationLabel: string;
};

export type EligibleSource = {
  objectUid: string;
  objectName: string;
  objectNamePlural: string;
  labelSingular: string;
  labelPlural: string;
  relations: SourceRelation[];
};

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

export const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** Parses one entry of the eligible-sources response. `null` when unusable. */
export const toEligibleSource = (value: unknown): EligibleSource | null => {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const objectUid = readString(record.objectUid);

  if (objectUid.length === 0) {
    return null;
  }

  const relations = Array.isArray(record.relations)
    ? record.relations
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          relationUid: readString(entry.relationUid),
          relationName: readString(entry.relationName),
          relationLabel: readString(entry.relationLabel),
        }))
        .filter((entry) => entry.relationUid.length > 0)
    : [];

  const objectName = readString(record.objectName);

  return {
    objectUid,
    objectName,
    objectNamePlural: readString(record.objectNamePlural) || objectName,
    labelSingular: readString(record.labelSingular) || objectName,
    labelPlural: readString(record.labelPlural) || objectName,
    relations,
  };
};

/** Parses a whole eligible-sources response body. */
export const parseEligibleSources = (data: unknown): EligibleSource[] => {
  const record = asRecord(data);

  if (record === null || !Array.isArray(record.sources)) {
    return [];
  }

  return record.sources
    .map(toEligibleSource)
    .filter((entry): entry is EligibleSource => entry !== null);
};
