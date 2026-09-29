import { DEFAULT_NAME_FIELD_LABEL } from 'src/engine/metadata-modules/object-metadata/constants/default-name-field-label.constant';
import { PARTIAL_SYSTEM_FLAT_FIELD_METADATAS } from 'src/engine/metadata-modules/object-metadata/constants/partial-system-flat-field-metadatas.constant';

type CustomObjectDefaultFieldProperties = {
  label: string;
  description: string;
};

// Labels and descriptions every custom object is created with, stored in the
// source locale and keyed by field name.
export const CUSTOM_OBJECT_DEFAULT_FIELD_PROPERTIES: ReadonlyMap<
  string,
  CustomObjectDefaultFieldProperties
> = new Map([
  [
    'name',
    { label: DEFAULT_NAME_FIELD_LABEL, description: DEFAULT_NAME_FIELD_LABEL },
  ],
  ...Object.values(PARTIAL_SYSTEM_FLAT_FIELD_METADATAS).map(
    ({ name, label, description }) =>
      [name, { label, description }] as [
        string,
        CustomObjectDefaultFieldProperties,
      ],
  ),
]);
