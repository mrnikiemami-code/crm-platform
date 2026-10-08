import {
  type PreviewLoadState,
  resolvePreviewLoadState,
} from 'src/components/bulk-composer-state';

export type PreviewRequest = {
  body: string;
  personIds: string[];
  /**
   * Present keys are explicit choices and are validated by the server (an empty
   * or invalid value is reported, never replaced by the Person's own number).
   */
  phoneOverrides: Record<string, unknown>;
};

export type PreviewTransport = (
  request: PreviewRequest,
) => Promise<{ ok: boolean; data: unknown }>;

export type PreviewConnection = {
  /**
   * Starts a preview. The previous in-flight preview (if any) is superseded, so
   * its eventual response can no longer publish state.
   */
  start: (request: PreviewRequest) => Promise<void>;
  /**
   * Voids any in-flight preview without starting a new one. Used when an input
   * changes (so the old preview can never come back) and on unmount.
   */
  invalidate: () => void;
};

/**
 * Owns the composer's preview lifecycle. Every input change calls
 * `invalidate()` — which bumps a monotonic request id — and only the LATEST
 * request may publish state. A stale success or a stale failure is dropped
 * entirely, so an old preview can never reappear after the text, template,
 * number, recipient set or selection changed. `invalidate()` on unmount
 * silences an in-flight request for good.
 */
export const createPreviewConnection = (options: {
  transport: PreviewTransport;
  onState: (state: PreviewLoadState) => void;
}): PreviewConnection => {
  let latestRequestId = 0;

  const invalidate = (): void => {
    latestRequestId += 1;
  };

  const start = async (request: PreviewRequest): Promise<void> => {
    latestRequestId += 1;
    const requestId = latestRequestId;

    options.onState({ kind: 'LOADING' });

    try {
      const response = await options.transport(request);

      if (requestId !== latestRequestId) {
        return;
      }

      options.onState(resolvePreviewLoadState(response));
    } catch {
      if (requestId !== latestRequestId) {
        return;
      }

      options.onState({ kind: 'ERROR' });
    }
  };

  return { start, invalidate };
};
