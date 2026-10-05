import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  type CommunicationTimelineActivity,
  type CommunicationTimelineRecord,
  type CommunicationTimelineSource,
} from 'src/timeline/communication-timeline-record.type';

// The workspace REST API exposes objects at /rest/<objectNamePlural>, and a
// single record at /rest/<objectNamePlural>/<id>. Reading by id is the
// supported path for app front components.
const TIMELINE_ACTIVITIES_REST_PATH = '/rest/timelineActivities';
const COMMUNICATIONS_REST_PATH = '/rest/communications';

type TimelineActivityRestResponse = {
  data?: { timelineActivity?: CommunicationTimelineActivity | null } | null;
};

type CommunicationRestResponse = {
  data?: { communication?: CommunicationTimelineRecord | null } | null;
};

/**
 * Read-only data source backed by the workspace REST API.
 *
 * This never touches a provider, never sends, and never mutates anything: it
 * only resolves the activity and the record it links to.
 */
export const createCommunicationTimelineRestSource =
  (): CommunicationTimelineSource => ({
    loadActivity: async (
      timelineActivityId: string,
    ): Promise<CommunicationTimelineActivity | null> => {
      const response =
        await new RestApiClient().get<TimelineActivityRestResponse>(
          `${TIMELINE_ACTIVITIES_REST_PATH}/${encodeURIComponent(timelineActivityId)}`,
        );

      return response.data?.timelineActivity ?? null;
    },

    loadCommunication: async (
      communicationId: string,
    ): Promise<CommunicationTimelineRecord | null> => {
      const response = await new RestApiClient().get<CommunicationRestResponse>(
        `${COMMUNICATIONS_REST_PATH}/${encodeURIComponent(communicationId)}`,
      );

      // A response without a communication payload means the linked id does
      // not resolve to a Communication record.
      return response.data?.communication ?? null;
    },
  });
