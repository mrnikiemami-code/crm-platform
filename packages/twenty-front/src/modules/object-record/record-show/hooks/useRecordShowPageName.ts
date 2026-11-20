import { useLabelIdentifierFieldMetadataItem } from '@/object-metadata/hooks/useLabelIdentifierFieldMetadataItem';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { getLabelIdentifierFieldValue } from '@/object-metadata/utils/getLabelIdentifierFieldValue';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { isDefined } from 'twenty-shared/utils';

// The record panel's own header and the side panel top bar must agree on what
// this record is called; both read it from here rather than the URL.
export const useRecordShowPageName = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const { labelIdentifierFieldMetadataItem } =
    useLabelIdentifierFieldMetadataItem({ objectNameSingular });

  const { objectMetadataItem } = useObjectMetadataItem({ objectNameSingular });

  const recordStore = useAtomFamilyStateValue(
    recordStoreFamilyState,
    objectRecordId,
  );

  if (!isDefined(recordStore)) {
    return objectMetadataItem.labelSingular;
  }

  const recordName = getLabelIdentifierFieldValue(
    recordStore,
    labelIdentifierFieldMetadataItem,
  ).trim();

  return recordName === '' ? objectMetadataItem.labelSingular : recordName;
};
