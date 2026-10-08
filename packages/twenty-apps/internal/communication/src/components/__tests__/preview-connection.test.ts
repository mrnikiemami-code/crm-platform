import { describe, expect, it } from 'vitest';

import {
  createPreviewConnection,
  type PreviewRequest,
  type PreviewTransport,
} from 'src/components/preview-connection';
import { type PreviewLoadState } from 'src/components/bulk-composer-state';

// A transport whose responses are resolved manually, so a test can hold an
// earlier request open while a newer one (or an invalidation) happens. This
// drives the REAL production connection (`createPreviewConnection`) — the same
// object the composer creates and calls — not a re-implementation.
const createDeferredTransport = () => {
  const pending: {
    request: PreviewRequest;
    resolve: (value: { ok: boolean; data: unknown }) => void;
  }[] = [];

  const transport: PreviewTransport = (request) =>
    new Promise((resolve) => {
      pending.push({ request, resolve });
    });

  return { transport, pending };
};

const readyResponse = (text: string) => ({
  ok: true,
  data: {
    success: true,
    previews: [
      {
        personId: 'p1',
        displayName: 'سارا',
        phone: '09120000001',
        previewText: text,
        hasUnresolvedVariables: false,
        isBodyEmpty: false,
        issues: [],
        isReadyToSend: true,
      },
    ],
    hasUnresolvedVariables: false,
    isBodyEmpty: false,
    readyCount: 1,
    sharedPhoneWarnings: [],
    duplicatePersonIds: [],
    invalidOverrides: [],
  },
});

const buildConnection = () => {
  const { transport, pending } = createDeferredTransport();
  const states: PreviewLoadState[] = [];

  const connection = createPreviewConnection({
    transport,
    onState: (state) => states.push(state),
  });

  return { connection, pending, states };
};

const request = (body: string): PreviewRequest => ({
  body,
  personIds: ['p1'],
  phoneOverrides: {},
});

describe('preview connection invalidation (real production wiring)', () => {
  it('publishes the result of a single preview', async () => {
    const { connection, pending, states } = buildConnection();

    const started = connection.start(request('سلام @name'));
    pending[0].resolve(readyResponse('سلام سارا'));
    await started;

    expect(states[0]).toEqual({ kind: 'LOADING' });
    expect(states[states.length - 1]).toEqual({
      kind: 'READY',
      previews: [
        {
          personId: 'p1',
          displayName: 'سارا',
          phone: '09120000001',
          previewText: 'سلام سارا',
          hasUnresolvedVariables: false,
          issues: [],
          isReadyToSend: true,
        },
      ],
      hasUnresolvedVariables: false,
      isBodyEmpty: false,
      readyCount: 1,
      sharedPhoneWarnings: [],
      duplicatePersonIds: [],
      invalidOverrides: [],
    });
  });

  it('ignores a stale response after the text changed (invalidate)', async () => {
    const { connection, pending, states } = buildConnection();

    // First preview is in flight; the user edits the text, which invalidates it.
    const first = connection.start(request('متن قدیمی @name'));
    connection.invalidate();

    // A newer preview starts and resolves.
    const second = connection.start(request('متن جدید @name'));
    pending[1].resolve(readyResponse('متن جدید سارا'));
    await second;

    // The stale first response arrives AFTER the new one — it must be dropped.
    pending[0].resolve(readyResponse('متن قدیمی سارا'));
    await first;

    const last = states[states.length - 1];

    expect(last.kind).toBe('READY');

    if (last.kind === 'READY') {
      expect(last.previews[0].previewText).toBe('متن جدید سارا');
    }

    // The stale text never appears in any published state.
    expect(
      states.some(
        (state) =>
          state.kind === 'READY' &&
          state.previews.some((preview) =>
            preview.previewText.includes('قدیمی'),
          ),
      ),
    ).toBe(false);
  });

  it('drops a stale FAILURE too, so an old error cannot resurface', async () => {
    const { connection, pending, states } = buildConnection();

    const stale = connection.start(request('متن قدیمی'));
    connection.invalidate();

    const fresh = connection.start(request('متن جدید'));
    pending[1].resolve(readyResponse('متن جدید سارا'));
    await fresh;

    // The stale request now fails — its ERROR must not replace the fresh READY.
    pending[0].resolve({ ok: false, data: {} });
    await stale;

    expect(states[states.length - 1].kind).toBe('READY');
    expect(states.some((state) => state.kind === 'ERROR')).toBe(false);
  });

  it('silences an in-flight preview when invalidated without a replacement (unmount)', async () => {
    const { connection, pending, states } = buildConnection();

    const inFlight = connection.start(request('متن @name'));
    // Unmount: invalidate with no follow-up request.
    connection.invalidate();

    pending[0].resolve(readyResponse('متن سارا'));
    await inFlight;

    // Only the LOADING state was ever published; the late response is dropped.
    expect(states).toEqual([{ kind: 'LOADING' }]);
  });

  it('reports an ERROR when the transport itself throws', async () => {
    const states: PreviewLoadState[] = [];
    const connection = createPreviewConnection({
      transport: async () => {
        throw new Error('network down');
      },
      onState: (state) => states.push(state),
    });

    await connection.start(request('متن @name'));

    expect(states[states.length - 1]).toEqual({ kind: 'ERROR' });
  });
});
