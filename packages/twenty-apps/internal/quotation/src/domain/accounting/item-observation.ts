import {
  type RemoteCatalogItem,
  type RemoteCatalogObservation,
} from 'src/domain/accounting/adapter-contract';

export const ITEM_OBSERVATION_SCHEMA_VERSION = '1';

export type CatalogItemObservationSnapshot = {
  version: typeof ITEM_OBSERVATION_SCHEMA_VERSION;
  capturedAt: string;
  externalItemId: string;
  vendorUnitId: string | null;
  vendorUnitName: string | null;
  vendorSecondaryUnitName: string | null;
  observation: RemoteCatalogObservation | null;
};

export const buildCatalogItemObservationSnapshot = ({
  item,
  capturedAt,
}: {
  item: Pick<
    RemoteCatalogItem,
  'externalItemId' | 'observation' | 'secondaryName'
  >;
  capturedAt: string;
}): CatalogItemObservationSnapshot => {
  const observation = item.observation ?? null;

  return {
    version: ITEM_OBSERVATION_SCHEMA_VERSION,
    capturedAt,
    externalItemId: item.externalItemId,
    vendorUnitId:
      observation?.unitId !== undefined ? String(observation.unitId) : null,
    vendorUnitName: observation?.unitName ?? null,
    vendorSecondaryUnitName:
      observation?.secondaryUnitName ?? null,
    observation,
  };
};

export const serializeItemObservation = (
  snapshot: CatalogItemObservationSnapshot,
): { observationJson: string; observationVersion: string } => ({
  observationJson: JSON.stringify(snapshot),
  observationVersion: snapshot.version,
});