import { defineFrontComponent } from 'twenty-sdk/define';
import { useTimelineActivityId, useTranslate } from 'twenty-sdk/front-component';

import { COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildCommunicationTimelinePresentation } from 'src/timeline/communication-timeline-presentation';

// The host renders this card for one timeline activity. The activity id is
// available natively; the persisted snapshot itself is read by the host and
// passed through the renderer context where available.
type TimelineCardProps = {
  event?: {
    properties?: Record<string, unknown> | null;
  };
};

const CommunicationTimelineCard = ({ event }: TimelineCardProps) => {
  const { t } = useTranslate();
  const timelineActivityId = useTimelineActivityId();

  const presentation = buildCommunicationTimelinePresentation(
    (event?.properties ?? null) as never,
  );

  return (
    <div
      data-communication-timeline-activity-id={timelineActivityId ?? ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        minWidth: 0,
      }}
    >
      <span style={{ fontWeight: 500 }}>{t(presentation.title)}</span>

      {presentation.recipient !== null && (
        <span style={{ opacity: 0.7 }}>{presentation.recipient}</span>
      )}

      {presentation.bodyPreview !== null && (
        <span
          style={{
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {presentation.bodyPreview}
        </span>
      )}

      {presentation.isFailed && presentation.failureReason !== null && (
        <span style={{ color: '#e05252' }}>{presentation.failureReason}</span>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'communication-timeline-card',
  description: 'Renders a Communication entry in the Person timeline.',
  component: CommunicationTimelineCard,
});
