import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  useTimelineActivityId,
  useTranslate,
} from 'twenty-sdk/front-component';

import { COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createCommunicationTimelineRestSource } from 'src/timeline/communication-rest-source';
import {
  type CommunicationTimelineLoadState,
  loadCommunicationTimelineState,
} from 'src/timeline/communication-timeline-record.type';
import {
  buildCommunicationTimelineView,
  LOADING_TITLE,
  REFRESH_LABEL,
  UNAVAILABLE_TITLE,
} from 'src/timeline/communication-timeline-presentation';

// The host injects only `timelineActivityId` for a timeline renderer; the
// activity row and its linked record are NOT provided. `recordId` is null in
// this context and is therefore never used as the linked record.
//
// Refresh is MANUAL: there is no subscription or invalidation channel exposed
// to the front-component sandbox, so the card offers an explicit Refresh
// action and does not claim to update automatically.
const CommunicationTimelineCard = () => {
  const { t } = useTranslate();
  const timelineActivityId = useTimelineActivityId();

  const [state, setState] = useState<CommunicationTimelineLoadState>({
    kind: 'LOADING',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Guards against a slow earlier response overwriting a newer one.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const result = await loadCommunicationTimelineState({
      timelineActivityId,
      source: createCommunicationTimelineRestSource(),
    });

    // A stale response must not replace the state of a newer request.
    if (requestId === requestIdRef.current) {
      setState(result);
      setIsRefreshing(false);
    }
  }, [timelineActivityId]);

  useEffect(() => {
    setState({ kind: 'LOADING' });
    void load();
  }, [load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setState({ kind: 'LOADING' });
    void load();
  };

  const view = buildCommunicationTimelineView(state);

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    minWidth: 0,
  };

  const refreshButton = (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      style={{
        alignSelf: 'flex-start',
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        cursor: isRefreshing ? 'default' : 'pointer',
        font: 'inherit',
        opacity: isRefreshing ? 0.5 : 0.8,
        padding: 0,
        textDecoration: 'underline',
      }}
    >
      {t(REFRESH_LABEL)}
    </button>
  );

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
        {refreshButton}
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

      {view.isPending && refreshButton}
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
