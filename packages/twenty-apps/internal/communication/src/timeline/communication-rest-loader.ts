import { RestApiClient } from 'twenty-client-sdk/rest';

import { type CommunicationTimelineRecord } from 'src/timeline/communication-timeline-record.type';

// The workspace REST API exposes app-owned objects at /rest/<objectNamePlural>.
// Reading the record by id is the supported path for app front components; the
// renderer context only supplies the timeline activity id.
const COMMUNICATION_REST_PATH = '/rest/communications';

type CommunicationRestResponse = {
  data?: { communication?: CommunicationTimelineRecord | null } | null;
};

/**
 * Reads one persisted Communication through the workspace REST API.
 *
 * Status is read live from the record, which is what keeps the timeline card
 * truthful after an outcome update without creating a second activity.
 *
 * This never touches a provider, never sends, and never mutates anything.
 */
export const loadCommunicationTimelineRecordFromRest =
  async (communicationId: string): Promise<CommunicationTimelineRecord> => {
    const response = await new RestApiClient().get<CommunicationRestResponse>(
      `${COMMUNICATION_REST_PATH}/${encodeURIComponent(communicationId)}`,
    );

    return response.data?.communication ?? {};
  };
