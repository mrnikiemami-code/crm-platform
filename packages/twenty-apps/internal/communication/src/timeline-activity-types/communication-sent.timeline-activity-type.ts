import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  COMMUNICATION_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// No `emit`: the Person timeline is not updated automatically by the
// `targetPerson` relation. The activity is created explicitly by the app's
// `on-communication-created` logic function through the native
// `createTimelineActivity` helper, which is what links the activity to the
// Person and to the persisted Communication record.
export default defineTimelineActivityType({
  universalIdentifier:
    COMMUNICATION_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'communicationSent',
  label: 'sent a message',
  icon: 'IconSend',
  frontComponentUniversalIdentifier:
    COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
