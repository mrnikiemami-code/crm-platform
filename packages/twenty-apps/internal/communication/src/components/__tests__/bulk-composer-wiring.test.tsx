// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The composer imports the SDK runtime hooks; stub only those, so the REAL
// component and its REAL wiring (preview connection + send connection) run.
vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (message: string) => message }),
  useLocale: () => 'en',
  unmountFrontComponent: vi.fn(),
  closeSidePanel: vi.fn(),
}));

// The route transport is the ONLY external boundary faked: the test asserts the
// composer's buttons actually drive the coordinator, one `/communication/send`
// per recipient, with the confirmed number and text.
type RouteCall = [
  path: string,
  method: string,
  body?: Record<string, unknown>,
  options?: { timeoutMs?: number },
];

const callAppRoute = vi.fn<
  (
    path: string,
    method: string,
    body?: unknown,
    options?: unknown,
  ) => Promise<unknown>
>();

const routeCalls = (): RouteCall[] =>
  callAppRoute.mock.calls.map((call) => [
    call[0],
    call[1],
    call[2] as Record<string, unknown> | undefined,
    call[3] as { timeoutMs?: number } | undefined,
  ]);

const sendCalls = () =>
  routeCalls().filter((call) => call[0] === '/communication/send');

vi.mock('src/components/composer-shared', async () => {
  const actual = await vi.importActual<
    typeof import('src/components/composer-shared')
  >('src/components/composer-shared');

  return {
    ...actual,
    callAppRoute: (
      path: string,
      method: string,
      body?: unknown,
      options?: unknown,
    ) => callAppRoute(path, method, body, options),
  };
});

import { BulkPersonComposer } from 'src/components/bulk-composer';

const P1 = 'p1';
const P2 = 'p2';
const P3 = 'p3';

type RecipientSpec = {
  personId: string;
  displayName: string;
  phone: string;
};

const buildRecipientsResponse = (specs: RecipientSpec[]) => ({
  ok: true,
  status: 200,
  data: {
    success: true,
    recipients: specs.map((spec) => ({
      personId: spec.personId,
      displayName: spec.displayName,
      status: 'SENDABLE',
      phones: [{ id: 'primary', value: spec.phone, isPrimary: true }],
      selectedPhone: spec.phone,
    })),
    duplicatePersonIds: [],
    sharedPhoneWarnings: [],
    sendableCount: specs.length,
    unsendableCount: 0,
  },
});

const buildPreviewResponse = (
  entries: {
    personId: string;
    displayName: string;
    phone: string | null;
    previewText: string;
    isReadyToSend: boolean;
    issues?: { token: string; kind: 'EMPTY_FIELD' | 'UNKNOWN_VARIABLE' }[];
  }[],
) => ({
  ok: true,
  status: 200,
  data: {
    success: true,
    previews: entries.map((entry) => ({
      personId: entry.personId,
      displayName: entry.displayName,
      phone: entry.phone,
      previewText: entry.previewText,
      hasUnresolvedVariables: (entry.issues ?? []).length > 0,
      isBodyEmpty: false,
      issues: entry.issues ?? [],
      isReadyToSend: entry.isReadyToSend,
    })),
    hasUnresolvedVariables: entries.some((entry) => (entry.issues ?? []).length > 0),
    isBodyEmpty: false,
    readyCount: entries.filter((entry) => entry.isReadyToSend).length,
    sharedPhoneWarnings: [],
    duplicatePersonIds: [],
    invalidOverrides: [],
  },
});

const templatesResponse = {
  ok: true,
  status: 200,
  data: { success: true, templates: [], variables: [] },
};

const acceptedSend = (status: 'SENT' | 'DELIVERED' = 'SENT') => ({
  ok: true,
  status: 200,
  data: { success: true, status },
});

const definiteFailureSend = (error = 'mock rejection') => ({
  ok: true,
  status: 200,
  data: { success: false, failureCode: 'PROVIDER_FAILED', error },
});

const unknownSend = () => ({
  ok: true,
  status: 200,
  data: { success: false, isOutcomeKnown: false, error: 'boom' },
});

const recordingProblemSend = () => ({
  ok: true,
  status: 200,
  data: {
    success: false,
    failureCode: 'OUTCOME_NOT_PERSISTED',
    status: 'SENT',
    error: 'The message was sent but its result could not be recorded. Do not retry automatically.',
  },
});

type SendResponder = (personId: string) => unknown | Promise<unknown>;

const TWO: RecipientSpec[] = [
  { personId: P1, displayName: 'Sara', phone: '09120000001' },
  { personId: P2, displayName: 'Reza', phone: '09120000002' },
];

const READY_PREVIEW = buildPreviewResponse([
  {
    personId: P1,
    displayName: 'Sara',
    phone: '09120000001',
    previewText: 'سلام سارا',
    isReadyToSend: true,
  },
  {
    personId: P2,
    displayName: 'Reza',
    phone: '09120000002',
    previewText: 'سلام رضا',
    isReadyToSend: true,
  },
]);

const installRoutes = ({
  recipients = TWO,
  preview = READY_PREVIEW,
  onSend,
}: {
  recipients?: RecipientSpec[];
  preview?: unknown;
  onSend: SendResponder;
}) => {
  const implementation = vi.fn(async (path: string, _method: string, body: unknown) => {
    if (path === '/communication/bulk-recipients') {
      return buildRecipientsResponse(recipients);
    }

    if (path === '/communication/message-templates') {
      return templatesResponse;
    }

    if (path === '/communication/preview-template') {
      return preview;
    }

    if (path === '/communication/send') {
      const personId = (body as { personId: string }).personId;

      return onSend(personId);
    }

    throw new Error(`unexpected route ${path}`);
  });

  callAppRoute.mockImplementation(implementation);

  return implementation;
};

const setTextarea = (value: string) => {
  const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
  // The LAST textarea is the composer's message box (template selects and the
  // recipient list contain no other textareas).
  const textarea = textareas[textareas.length - 1];
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

const clickButton = (label: string) => {
  const button = screen.getByText(label) as HTMLButtonElement;
  button.click();

  return button;
};

const renderComposer = async (personIds: string[] = [P1, P2]) => {
  const result = render(<BulkPersonComposer personIds={personIds} />);

  await act(async () => {
    await Promise.resolve();
  });

  return result;
};

const waitForRecipients = async () => {
  await waitFor(() => {
    expect(
      routeCalls().some((call) => call[0] === '/communication/bulk-recipients'),
    ).toBe(true);
  });
};

const doPreview = async () => {
  await act(async () => {
    setTextarea('سلام @name');
  });

  await act(async () => {
    clickButton('Preview');
  });

  await waitFor(() => {
    expect(
      routeCalls().some((call) => call[0] === '/communication/preview-template'),
    ).toBe(true);
  });
};

describe('BulkPersonComposer — real wiring', () => {
  beforeEach(() => {
    callAppRoute.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends one /communication/send per recipient with the confirmed number and text', async () => {
    installRoutes({ onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    const [first, second] = sendCalls();

    expect(first[2]).toEqual({
      personId: P1,
      channel: 'SMS',
      recipient: '09120000001',
      body: 'سلام سارا',
    });
    expect(second[2]).toEqual({
      personId: P2,
      channel: 'SMS',
      recipient: '09120000002',
      body: 'سلام رضا',
    });

    // The bulk request carries the documented deadline.
    expect(first[3]).toEqual({ timeoutMs: 60_000 });
  });

  it('does not send when the preview is missing (review button disabled)', async () => {
    installRoutes({ onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();

    const review = screen.getByText('Review and send') as HTMLButtonElement;

    expect(review.disabled).toBe(true);
  });

  // A. Shared numbers ---------------------------------------------------------

  it('A: a shared number gates ONLY the final send button; cancel resets consent', async () => {
    const sharedPreview = buildPreviewResponse([
      {
        personId: P1,
        displayName: 'Sara',
        phone: '09120000001',
        previewText: 'سلام سارا',
        isReadyToSend: true,
      },
      {
        personId: P2,
        displayName: 'Reza',
        phone: '09120000001',
        previewText: 'سلام رضا',
        isReadyToSend: true,
      },
    ]);

    installRoutes({ preview: sharedPreview, onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    // Opening review MUST work even with a shared number.
    await act(async () => {
      clickButton('Review and send');
    });

    expect(screen.getByText('Confirm sending')).toBeTruthy();

    // The final send button is disabled until the shared number is acknowledged.
    const sendBefore = screen.getByText('Send to each person') as HTMLButtonElement;

    expect(sendBefore.disabled).toBe(true);

    // No request was made just by opening review.
    expect(sendCalls()).toHaveLength(0);

    await act(async () => {
      (screen.getByRole('checkbox') as HTMLInputElement).click();
    });

    const sendAfter = screen.getByText('Send to each person') as HTMLButtonElement;

    expect(sendAfter.disabled).toBe(false);

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    // Both confirmed recipients were sent, on the shared number.
    expect(sendCalls().map((call) => call[2]?.recipient)).toEqual([
      '09120000001',
      '09120000001',
    ]);
  });

  it('A: cancelling and reopening review resets the acknowledgement', async () => {
    const sharedPreview = buildPreviewResponse([
      {
        personId: P1,
        displayName: 'Sara',
        phone: '09120000001',
        previewText: 'سلام سارا',
        isReadyToSend: true,
      },
      {
        personId: P2,
        displayName: 'Reza',
        phone: '09120000001',
        previewText: 'سلام رضا',
        isReadyToSend: true,
      },
    ]);

    installRoutes({ preview: sharedPreview, onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      (screen.getByRole('checkbox') as HTMLInputElement).click();
    });

    expect(
      (screen.getByText('Send to each person') as HTMLButtonElement).disabled,
    ).toBe(false);

    // Cancel, then reopen: the acknowledgement is gone.
    await act(async () => {
      clickButton('Cancel');
    });

    await act(async () => {
      clickButton('Review and send');
    });

    expect(
      (screen.getByText('Send to each person') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(sendCalls()).toHaveLength(0);
  });

  // B. Running progress -------------------------------------------------------

  it('B: shows completed results while running, marks the in-flight one SENDING, and keeps results after a stop', async () => {
    const deferred: {
      personId: string;
      resolve: (value: unknown) => void;
    }[] = [];

    installRoutes({
      recipients: [
        ...TWO,
        { personId: P3, displayName: 'Mina', phone: '09120000003' },
      ],
      preview: buildPreviewResponse([
        {
          personId: P1,
          displayName: 'Sara',
          phone: '09120000001',
          previewText: 'سلام سارا',
          isReadyToSend: true,
        },
        {
          personId: P2,
          displayName: 'Reza',
          phone: '09120000002',
          previewText: 'سلام رضا',
          isReadyToSend: true,
        },
        {
          personId: P3,
          displayName: 'Mina',
          phone: '09120000003',
          previewText: 'سلام مینا',
          isReadyToSend: true,
        },
      ]),
      onSend: (personId) =>
        new Promise((resolve) => {
          deferred.push({ personId, resolve });
        }),
    });

    await renderComposer([P1, P2, P3]);
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    // First request in flight.
    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    expect(deferred[0].personId).toBe(P1);
    // The in-flight recipient is shown SENDING, never "Not started".
    expect(screen.getAllByText('Sending…').length).toBeGreaterThanOrEqual(1);

    // Resolve the first; the second stays deferred.
    await act(async () => {
      deferred[0].resolve(acceptedSend());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    // First result is visible and completed; second is SENDING.
    expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sending…').length).toBeGreaterThanOrEqual(1);

    // Stop while the second is pending: no third request is made.
    await act(async () => {
      clickButton('Stop after current');
    });

    await act(async () => {
      deferred[1].resolve(acceptedSend());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(2);
    });

    // Exactly two requests: the third recipient was never attempted.
    expect(sendCalls()).toHaveLength(2);

    // The stopped group keeps the results; the third stays NOT_STARTED and is
    // never labelled cancelled/unsent.
    expect(screen.getAllByText('Not started').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Sending was stopped.')).toBeTruthy();
  });

  // C is covered by composer-shared-deadline.test.ts (the real transport).

  it('C: a transport rejection is classified UNKNOWN and stops the group', async () => {
    installRoutes({
      recipients: [
        ...TWO,
        { personId: P3, displayName: 'Mina', phone: '09120000003' },
      ],
      preview: buildPreviewResponse([
        {
          personId: P1,
          displayName: 'Sara',
          phone: '09120000001',
          previewText: 'a',
          isReadyToSend: true,
        },
        {
          personId: P2,
          displayName: 'Reza',
          phone: '09120000002',
          previewText: 'b',
          isReadyToSend: true,
        },
        {
          personId: P3,
          displayName: 'Mina',
          phone: '09120000003',
          previewText: 'c',
          isReadyToSend: true,
        },
      ]),
      onSend: (personId) => {
        if (personId === P1) {
          throw new Error('timeout');
        }

        return acceptedSend();
      },
    });

    await renderComposer([P1, P2, P3]);
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(screen.getAllByText('Outcome unknown').length).toBeGreaterThanOrEqual(1);
    });

    // The group stopped: only the first recipient was attempted.
    expect(sendCalls()).toHaveLength(1);
    expect(screen.queryByText('The group was stopped.')).toBeTruthy();
  });

  // D. Duplicate final-send clicks --------------------------------------------

  it('D: two final-send clicks before the first request resolves start only ONE run', async () => {
    const deferred: { resolve: (value: unknown) => void }[] = [];

    installRoutes({
      onSend: () =>
        new Promise((resolve) => {
          deferred.push({ resolve });
        }),
    });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    const sendButton = screen.getByText('Send to each person') as HTMLButtonElement;

    await act(async () => {
      sendButton.click();
      sendButton.click();
      await Promise.resolve();
    });

    // Only the first person's request was made — no duplicate run.
    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    await act(async () => {
      deferred[0].resolve(acceptedSend());
      await Promise.resolve();
    });

    // The single run then continues to the second recipient exactly once.
    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    expect(sendCalls().map((call) => call[2]?.personId)).toEqual([P1, P2]);
  });

  // E. Snapshot and stale preview ---------------------------------------------

  it('E: editing the text after a preview invalidates review before sending', async () => {
    installRoutes({ onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    // Review is available for the current preview.
    expect(
      (screen.getByText('Review and send') as HTMLButtonElement).disabled,
    ).toBe(false);

    // Editing the text invalidates the preview.
    await act(async () => {
      setTextarea('متن جدید @name');
    });

    await waitFor(() => {
      expect(
        (screen.getByText('Review and send') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    // And the confirmation panel is gone.
    expect(screen.queryByText('Confirm sending')).toBeNull();
    expect(sendCalls()).toHaveLength(0);
  });

  it('E: the confirmed text and number are what is sent (snapshot)', async () => {
    installRoutes({ onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    // Change the textarea AFTER opening review but BEFORE sending: the snapshot
    // shown in the panel is what must be sent.
    await act(async () => {
      setTextarea('متن عوض‌شده');
    });

    // The edit invalidated the preview, so review closed; re-preview and send.
    await act(async () => {
      clickButton('Preview');
    });

    await waitFor(() => {
      expect(
        (screen.getByText('Review and send') as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    // The server-provided per-person preview text is what is sent, not the
    // textarea value.
    expect(sendCalls()[0][2]?.body).toBe('سلام سارا');
    expect(sendCalls()[1][2]?.body).toBe('سلام رضا');
  });

  // F. Close / unmount --------------------------------------------------------

  it('F: unmounting during an in-flight request makes no next request and no late publication', async () => {
    const deferred: { resolve: (value: unknown) => void }[] = [];

    installRoutes({
      onSend: () =>
        new Promise((resolve) => {
          deferred.push({ resolve });
        }),
    });

    const { unmount } = await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    // Unmount (the real cleanup runs `invalidate()` on the send connection).
    unmount();

    // Resolve the in-flight request AFTER unmount: it must not start the next
    // recipient and must not publish any state.
    await act(async () => {
      deferred[0].resolve(acceptedSend());
      await Promise.resolve();
    });

    expect(sendCalls()).toHaveLength(1);
  });

  // G. Failure classification -------------------------------------------------

  it('G: a definite failure continues to the next recipient', async () => {
    installRoutes({
      onSend: (personId) =>
        personId === P1 ? definiteFailureSend('mock rejection') : acceptedSend(),
    });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(2);
    });

    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(1);
  });

  it('G: an unknown outcome stops the group and leaves the rest NOT_STARTED', async () => {
    installRoutes({
      recipients: [
        ...TWO,
        { personId: P3, displayName: 'Mina', phone: '09120000003' },
      ],
      preview: buildPreviewResponse([
        {
          personId: P1,
          displayName: 'Sara',
          phone: '09120000001',
          previewText: 'a',
          isReadyToSend: true,
        },
        {
          personId: P2,
          displayName: 'Reza',
          phone: '09120000002',
          previewText: 'b',
          isReadyToSend: true,
        },
        {
          personId: P3,
          displayName: 'Mina',
          phone: '09120000003',
          previewText: 'c',
          isReadyToSend: true,
        },
      ]),
      onSend: (personId) =>
        personId === P1 ? unknownSend() : acceptedSend(),
    });

    await renderComposer([P1, P2, P3]);
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(screen.getAllByText('Outcome unknown').length).toBeGreaterThanOrEqual(1);
    });

    expect(sendCalls()).toHaveLength(1);
    expect(screen.getAllByText('Not started').length).toBeGreaterThanOrEqual(2);
  });

  it('G: a recording problem stops the group', async () => {
    installRoutes({
      onSend: () => recordingProblemSend(),
    });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('Result not recorded').length,
      ).toBeGreaterThanOrEqual(1);
    });

    expect(sendCalls()).toHaveLength(1);
  });

  // H. Translation ------------------------------------------------------------

  it('H: an excluded recipient shows a fixed translated reason with tokens rendered separately', async () => {
    const mixedPreview = buildPreviewResponse([
      {
        personId: P1,
        displayName: 'Sara',
        phone: '09120000001',
        previewText: 'سلام سارا',
        isReadyToSend: true,
      },
      {
        personId: P2,
        displayName: 'Reza',
        phone: '09120000002',
        previewText: 'سلام @company',
        isReadyToSend: false,
        issues: [{ token: '@company', kind: 'EMPTY_FIELD' }],
      },
    ]);

    installRoutes({ preview: mixedPreview, onSend: () => acceptedSend() });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    // The fixed reason is its own translation key...
    expect(screen.getByText('The preview is not ready to send.')).toBeTruthy();
    // ...and the token is rendered SEPARATELY as data.
    expect(screen.getByText('@company')).toBeTruthy();

    // Only the ready recipient will be sent.
    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    expect(sendCalls()[0][2]?.personId).toBe(P1);
  });

  it('H: a definite failure shows the provider wording verbatim (not translated app copy)', async () => {
    installRoutes({
      onSend: (personId) =>
        personId === P1
          ? definiteFailureSend('خطای اختصاصی سرویس‌دهنده')
          : acceptedSend(),
    });

    await renderComposer();
    await waitForRecipients();
    await doPreview();

    await act(async () => {
      clickButton('Review and send');
    });

    await act(async () => {
      clickButton('Send to each person');
    });

    await waitFor(() => {
      expect(screen.getByText('خطای اختصاصی سرویس‌دهنده')).toBeTruthy();
    });
  });
});
