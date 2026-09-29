import { METADATA_LOCALIZATION_VERSION } from '@/metadata-store/constants/MetadataLocalizationVersion';

export const computeLocalizedCollectionHash = ({
  collectionHash,
  locale,
}: {
  collectionHash: string;
  locale: string;
}): string => `${collectionHash}:${locale}:v${METADATA_LOCALIZATION_VERSION}`;
