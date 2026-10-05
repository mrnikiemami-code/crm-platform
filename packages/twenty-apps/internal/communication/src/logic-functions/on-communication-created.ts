import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';
import { createTimelineActivity } from 'twenty-sdk/logic-function';

import { ON_COMMUNICATION_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  buildCommunicationTimelineActivityInput,
  type CommunicationRecordForTimeline,
} from 'src/timeline/build-communication-timeline-activity-input';

// The Person timeline is not updated automatically by the `targetPerson`
// relation, so the app creates the activity explicitly for each persisted
// Communication. This runs once per record creation, which keeps exactly one
// card per Communication; outcome updates do not create a second one.
//
// Timeline creation is deliberately isolated: if it throws, the persisted send
// outcome is unaffected, the provider is never called again, and no send or
// persistence orchestration is duplicated here.
const handler = async (
  payload: DatabaseEventPayload<
    ObjectRecordCreateEvent<CommunicationRecordForTimeline>
  >,
) => {
  const input = buildCommunicationTimelineActivityInput(payload.properties.after);

  // A communication with no person is not part of anyone's timeline.
  if (input === null) {
    return { processed: false, reason: 'NO_TARGET_PERSON' };
  }

  try {
    await createTimelineActivity(input);

    return { processed: true };
  } catch (error) {
    // Never let a timeline failure change the send outcome or surface raw
    // diagnostics. The activity is simply missing; the send itself stands.
    console.warn(
      '[communication] timeline activity could not be created',
      JSON.stringify({
        communicationId: payload.properties.after.id,
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    );

    return { processed: false, reason: 'TIMELINE_CREATION_FAILED' };
  }
};

export default defineLogicFunction({
  universalIdentifier:
    ON_COMMUNICATION_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-communication-created',
  description:
    'Adds a Communication entry to the target person timeline when one is recorded.',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'communication.created',
  },
});
