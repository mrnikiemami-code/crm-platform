import { useListenToMetadataOperationBrowserEvent } from '@/browser-event/hooks/useListenToMetadataOperationBrowserEvent';
import { useCleanMorphRelationsTargetingObjectMetadataId } from '@/metadata-store/hooks/useCleanMorphRelationsTargetingObjectMetadataId';
import { useUpdateMetadataStoreDraft } from '@/metadata-store/hooks/useUpdateMetadataStoreDraft';
import { type MetadataEntityKey } from '@/metadata-store/states/metadataStoreState';
import { type MetadataEntityTypeMap } from '@/metadata-store/types/MetadataEntityTypeMap';
import { computeLocalizedCollectionHash } from '@/metadata-store/utils/computeLocalizedCollectionHash';
import { getMetadataRequestLocale } from '@/metadata-store/utils/getMetadataRequestLocale';
import { mapAllMetadataNameToEntityKey } from '@/metadata-store/utils/mapAllMetadataNameToEntityKey';
import { useStore } from 'jotai';
import { isDefined } from 'twenty-shared/utils';

type AnyMetadataEntity = MetadataEntityTypeMap[MetadataEntityKey];

export const MetadataStoreSSEEffect = () => {
  const store = useStore();
  const { addToDraft, removeFromDraft, applyChanges } =
    useUpdateMetadataStoreDraft();
  const { cleanMorphRelations } =
    useCleanMorphRelationsTargetingObjectMetadataId();

  useListenToMetadataOperationBrowserEvent({
    onMetadataOperationBrowserEvent: (eventDetail) => {
      const entityKey = mapAllMetadataNameToEntityKey(eventDetail.metadataName);

      if (!isDefined(entityKey)) {
        return;
      }

      const collectionHash = isDefined(eventDetail.updatedCollectionHash)
        ? computeLocalizedCollectionHash({
            collectionHash: eventDetail.updatedCollectionHash,
            locale: getMetadataRequestLocale(store),
          })
        : undefined;

      switch (eventDetail.operation.type) {
        case 'create': {
          addToDraft({
            key: entityKey,
            items: [
              eventDetail.operation
                .createdRecord as unknown as AnyMetadataEntity,
            ],
            collectionHash,
          });
          break;
        }
        case 'update': {
          addToDraft({
            key: entityKey,
            items: [
              eventDetail.operation
                .updatedRecord as unknown as AnyMetadataEntity,
            ],
            collectionHash,
          });
          break;
        }
        case 'delete': {
          removeFromDraft({
            key: entityKey,
            itemIds: [eventDetail.operation.deletedRecordId],
            collectionHash,
          });

          if (entityKey === 'objectMetadataItems') {
            cleanMorphRelations(eventDetail.operation.deletedRecordId);
          }
          break;
        }
      }

      applyChanges();
    },
  });

  return null;
};
