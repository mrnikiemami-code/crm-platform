import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useRecordShowPageName } from '@/object-record/record-show/hooks/useRecordShowPageName';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';

export const RecordShowPageTitle = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const { objectMetadataItem } = useObjectMetadataItem({ objectNameSingular });

  const recordName = useRecordShowPageName({
    objectNameSingular,
    objectRecordId,
  });

  const pageTitle = recordName.trim()
    ? `${recordName} - ${objectMetadataItem.labelSingular}`
    : objectMetadataItem.labelSingular;

  return <PageTitle title={pageTitle} />;
};
