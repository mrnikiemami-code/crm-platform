import { describe, expect, it, vi } from 'vitest';

import {
  loadCommunicationTimelineRecord,
  readCommunicationTimelineRecordId,
  type CommunicationTimelineLoader,
} from 'src/timeline/communication-timeline-record.type';

const buildLoader = (
  record: unknown,
  shouldThrow = false,
): CommunicationTimelineLoader =>
  vi.fn(async () => {
    if (shouldThrow) {
      throw new Error('SECRET-API-KEY in transport error');
    }

    return record as never;
  });

describe('readCommunicationTimelineRecordId', () => {
  it('accepts a non-empty linked record id', () => {
    expect(readCommunicationTimelineRecordId('communication-1')).toBe(
      'communication-1',
    );
  });

  it('rejects blank and non-string values', () => {
    expect(readCommunicationTimelineRecordId(null)).toBeNull();
    expect(readCommunicationTimelineRecordId(undefined)).toBeNull();
    expect(readCommunicationTimelineRecordId('   ')).toBeNull();
    expect(readCommunicationTimelineRecordId(42)).toBeNull();
  });
});

describe('loadCommunicationTimelineRecord', () => {
  it('loads the linked communication record', async () => {
    const loader = buildLoader({ id: 'communication-1', status: 'SENT' });

    const state = await loadCommunicationTimelineRecord({
      linkedRecordId: 'communication-1',
      loader,
    });

    expect(loader).toHaveBeenCalledWith('communication-1');
    expect(state).toEqual({
      kind: 'LOADED',
      record: { id: 'communication-1', status: 'SENT' },
    });
  });

  it('reports UNAVAILABLE when the activity has no linked record', async () => {
    const loader = buildLoader({});

    const state = await loadCommunicationTimelineRecord({
      linkedRecordId: null,
      loader,
    });

    expect(state).toEqual({ kind: 'UNAVAILABLE', reason: 'NOT_FOUND' });
    // No request is issued when there is nothing to load.
    expect(loader).not.toHaveBeenCalled();
  });

  it('reports UNAVAILABLE for an inaccessible record', async () => {
    const loader = buildLoader({});

    const state = await loadCommunicationTimelineRecord({
      linkedRecordId: 'missing-1',
      loader,
    });

    expect(state).toEqual({ kind: 'LOADED', record: {} });
  });

  it('reports UNAVAILABLE when the load fails, without leaking the error', async () => {
    const loader = buildLoader(null, true);

    const state = await loadCommunicationTimelineRecord({
      linkedRecordId: 'communication-1',
      loader,
    });

    expect(state).toEqual({ kind: 'UNAVAILABLE', reason: 'ERROR' });
    expect(JSON.stringify(state)).not.toContain('SECRET-API-KEY');
  });

  it('never issues a write or provider call', async () => {
    const loader = buildLoader({ id: 'communication-1', status: 'QUEUED' });

    await loadCommunicationTimelineRecord({
      linkedRecordId: 'communication-1',
      loader,
    });

    // The loader is a read-only contract: one call, one id argument.
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith('communication-1');
  });
});
