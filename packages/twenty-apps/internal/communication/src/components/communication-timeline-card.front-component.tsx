import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  useFrontComponentExecutionContext,
  useTranslate,
} from 'twenty-sdk/front-component';

import { COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { loadCommunicationTimelineRecordFromRest } from 'src/timeline/communication-rest-loader';
import {
  type CommunicationTimelineLoadState,
  loadCommunicationTimelineRecord,
} from 'src/timeline/communication-timeline-record.type';
import {
  buildCommunicationTimelineView,
  LOADING_TITLE,
  UNAVAILABLE_TITLE,
} from 'src/timeline/communication-timeline-presentation';

// The host supplies only the timeline activity id to a renderer front
// component; it does not inject the activity row or its properties. The
// persisted Communication is therefore loaded through the workspace REST API.
const CommunicationTimelineCard = () => {
  const { t } = useTranslate();
  const context = useFrontComponentExecutionContext((value) => value);
  const timelineActivityId = context?.timelineActivityId ?? null;
  const linkedRecordId = context?.recordId ?? null;

  const [state, setState] = useState<CommunicationTimelineLoadState>({
    kind: 'LOADING',
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await loadCommunicationTimelineRecord({
        linkedRecordId,
        loader: loadCommunicationTimelineRecordFromRest,
      });

      if (!cancelled) {
        setState(result);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [linkedRecordId]);

  const view = buildCommunicationTimelineView(state);

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    minWidth: 0,
  };

  if (view.kind === 'LOADING') {
    return (
      <div
        data-communication-timeline-activity-id={timelineActivityId ?? ''}
        style={containerStyle}
      >
        <span style={{ opacity: 0.6 }}>{t(LOADING_TITLE)}</span>
      </div>
    );
  }

  if (view.kind === 'UNAVAILABLE') {
    // Missing data is reported as unavailable — never as QUEUED or success.
    return (
      <div
        data-communication-timeline-activity-id={timelineActivityId ?? ''}
        style={containerStyle}
      >
        <span style={{ opacity: 0.6 }}>{t(UNAVAILABLE_TITLE)}</span>
      </div>
    );
  }

  return (
    <div
      data-communication-timeline-activity-id={timelineActivityId ?? ''}
      style={containerStyle}
    >
      <span style={{ fontWeight: 500 }}>{t(view.title)}</span>

      {view.recipient !== null && (
        <span style={{ opacity: 0.7 }}>{view.recipient}</span>
      )}

      {view.bodyPreview !== null && (
        <span
          style={{
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {view.bodyPreview}
        </span>
      )}

      {view.isFailed && view.failureReason !== null && (
        <span style={{ color: '#e05252' }}>{view.failureReason}</span>
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
