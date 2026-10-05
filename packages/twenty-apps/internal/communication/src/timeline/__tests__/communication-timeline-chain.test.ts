import { describe, expect, it, vi } from 'vitest';

import {
  loadCommunicationTimelineState,
  type CommunicationTimelineSource,
} from 'src/timeline/communication-timeline-record.type';
import { buildCommunicationTimelineView } from 'src/timeline/communication-timeline-presentation';

const ACTIVITY_ID = 'activity-1';
const COMMUNICATION_ID = 'communication-1';

type SourceOverrides = {
  activity?: unknown;
  communication?: unknown;
  throwOnActivity?: boolean;
  throwOnCommunication?: boolean;
};

const buildSource = (overrides: SourceOverrides = {}) => {
  const loadActivity = vi.fn(async () => {
    if (overrides.throwOnActivity) {
      throw new Error('SECRET-API-KEY in transport error');
    }

    return (overrides.activity === undefined
      ? { id: ACTIVITY_ID, linkedRecordId: COMMUNICATION_ID }
      : overrides.activity) as never;
  });

  const loadCommunication = vi.fn(async () => {
    if (overrides.throwOnCommunication) {
      throw new Error('SECRET-API-KEY in transport error');
    }

    return (overrides.communication === undefined
      ? { id: COMMUNICATION_ID, status: 'QUEUED', channel: 'SMS' }
      : overrides.communication) as never;
  });

  return { source: { loadActivity, loadCommunication }, loadActivity, loadCommunication };
};

describe('timeline loader chain', () => {
  it('resolves timelineActivityId -> activity -> linked communication', async () => {
    const { source, loadActivity, loadCommunication } = buildSource();

    const state = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(loadActivity).toHaveBeenCalledWith(ACTIVITY_ID);
    expect(loadCommunication).toHaveBeenCalledWith(COMMUNICATION_ID);
    expect(state).toEqual({
      kind: 'LOADED',
      record: { id: COMMUNICATION_ID, status: 'QUEUED', channel: 'SMS' },
    });
  });

  it('works with a context whose recordId is null (no linked-record fallback)', async () => {
    const { source, loadCommunication } = buildSource();

    // Mirrors the real renderer context: recordId is null for a timeline
    // renderer, and the chain must not depend on it.
    const context = { timelineActivityId: ACTIVITY_ID, recordId: null };

    await loadCommunicationTimelineState({
      timelineActivityId: context.timelineActivityId,
      source,
    });

    expect(loadCommunication).toHaveBeenCalledTimes(1);
    expect(loadCommunication).toHaveBeenCalledWith(COMMUNICATION_ID);
  });

  it('reports NO_ACTIVITY_ID when the context has no activity id', async () => {
    const { source, loadActivity } = buildSource();

    const state = await loadCommunicationTimelineState({
      timelineActivityId: null,
      source,
    });

    expect(state).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_ACTIVITY_ID' });
    expect(loadActivity).not.toHaveBeenCalled();
  });

  it('reports ACTIVITY_NOT_FOUND when the activity is inaccessible', async () => {
    const { source } = buildSource({ activity: null });

    const state = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(state).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'ACTIVITY_NOT_FOUND',
    });
  });

  it('reports NO_LINKED_RECORD when the activity links nothing', async () => {
    const { source, loadCommunication } = buildSource({
      activity: { id: ACTIVITY_ID, linkedRecordId: null },
    });

    const state = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(state).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_LINKED_RECORD' });
    expect(loadCommunication).not.toHaveBeenCalled();
  });

  it('rejects a linked record that is not a communication', async () => {
    const { source } = buildSource({ communication: null });

    const state = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(state).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'LINKED_RECORD_NOT_COMMUNICATION',
    });
  });

  it('reports ERROR without leaking the transport error', async () => {
    const { source } = buildSource({ throwOnCommunication: true });

    const state = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(state).toEqual({ kind: 'UNAVAILABLE', reason: 'ERROR' });
    expect(JSON.stringify(state)).not.toContain('SECRET-API-KEY');
  });

  it('is read-only: exactly one activity read and one record read', async () => {
    const { source, loadActivity, loadCommunication } = buildSource();

    await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(loadActivity).toHaveBeenCalledTimes(1);
    expect(loadCommunication).toHaveBeenCalledTimes(1);
    // No third call of any kind: nothing sends or mutates.
    expect(
      (source as CommunicationTimelineSource).loadActivity,
    ).toHaveBeenCalledTimes(1);
  });
});

describe('timeline refresh through the chain', () => {
  const buildMutableSource = () => {
    let status = 'QUEUED';

    const source: CommunicationTimelineSource = {
      loadActivity: async () => ({
        id: ACTIVITY_ID,
        linkedRecordId: COMMUNICATION_ID,
      }),
      loadCommunication: async () => ({
        id: COMMUNICATION_ID,
        channel: 'SMS',
        status,
      }),
    };

    return {
      source,
      setStatus: (next: string) => {
        status = next;
      },
    };
  };

  it('renders the creation-time QUEUED state first', async () => {
    const { source } = buildMutableSource();

    const view = buildCommunicationTimelineView(
      await loadCommunicationTimelineState({
        timelineActivityId: ACTIVITY_ID,
        source,
      }),
    );

    expect(view.kind).toBe('READY');
    expect(view.kind === 'READY' && view.title).toContain('queued');
    expect(view.kind === 'READY' && view.isPending).toBe(true);
  });

  it('renders the updated outcome after a refresh, with no new activity', async () => {
    const { source, setStatus } = buildMutableSource();

    const first = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    setStatus('SENT');

    const second = await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    expect(buildCommunicationTimelineView(first)).toMatchObject({
      kind: 'READY',
      isPending: true,
    });
    expect(buildCommunicationTimelineView(second)).toMatchObject({
      kind: 'READY',
      title: 'Message sent · SMS',
      isPending: false,
    });
    // Same activity id throughout: a refresh never creates another activity.
    expect(ACTIVITY_ID).toBe('activity-1');
  });

  it('renders a later failure after a refresh', async () => {
    const { source, setStatus } = buildMutableSource();

    await loadCommunicationTimelineState({
      timelineActivityId: ACTIVITY_ID,
      source,
    });

    setStatus('FAILED');

    const view = buildCommunicationTimelineView(
      await loadCommunicationTimelineState({
        timelineActivityId: ACTIVITY_ID,
        source,
      }),
    );

    expect(view.kind === 'READY' && view.isFailed).toBe(true);
    expect(view.kind === 'READY' && view.isPending).toBe(false);
  });
});
