// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The composer imports the SDK runtime hooks; stub only those, so the REAL
// component and its REAL wiring (preview connection + send connection) run.
vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (message: string) => message }),
  useLocale: () => 'en',
  unmountFrontComponent: vi.fn(),
  closeSidePanel: vi.fn(),
}));

// The route transport is the only thing faked: the test asserts the composer's
// button actually drives the coordinator to one `/communication/send` per
// recipient, with the confirmed number and text.
type RouteCall = [path: string, method: string, body?: Record<string, unknown>];

const callAppRoute = vi.fn<(path: string, method: string, body?: unknown) => Promise<unknown>>();

const routeCalls = (): RouteCall[] =>
  callAppRoute.mock.calls.map(
    (call) => [call[0], call[1], call[2] as Record<string, unknown> | undefined],
  );

vi.mock('src/components/composer-shared', async () => {
  const actual = await vi.importActual<
    typeof import('src/components/composer-shared')
  >('src/components/composer-shared');

  return {
    ...actual,
    callAppRoute: (path: string, method: string, body?: unknown) =>
      callAppRoute(path, method, body),
  };
});

import { BulkPersonComposer } from 'src/components/bulk-composer';

const P1 = 'p1';
const P2 = 'p2';

const recipientsResponse = {
  ok: true,
  status: 200,
  data: {
    success: true,
    recipients: [
      {
        personId: P1,
        displayName: 'Sara',
        status: 'SENDABLE',
        phones: [{ id: 'primary', value: '09120000001', isPrimary: true }],
        selectedPhone: '09120000001',
      },
      {
        personId: P2,
        displayName: 'Reza',
        status: 'SENDABLE',
        phones: [{ id: 'primary', value: '09120000002', isPrimary: true }],
        selectedPhone: '09120000002',
      },
    ],
    duplicatePersonIds: [],
    sharedPhoneWarnings: [],
    sendableCount: 2,
    unsendableCount: 0,
  },
};

const templatesResponse = {
  ok: true,
  status: 200,
  data: { success: true, templates: [], variables: [] },
};

const previewResponse = {
  ok: true,
  status: 200,
  data: {
    success: true,
    previews: [
      {
        personId: P1,
        displayName: 'Sara',
        phone: '09120000001',
        previewText: 'سلام سارا',
        hasUnresolvedVariables: false,
        isBodyEmpty: false,
        issues: [],
        isReadyToSend: true,
      },
      {
        personId: P2,
        displayName: 'Reza',
        phone: '09120000002',
        previewText: 'سلام رضا',
        hasUnresolvedVariables: false,
        isBodyEmpty: false,
        issues: [],
        isReadyToSend: true,
      },
    ],
    hasUnresolvedVariables: false,
    isBodyEmpty: false,
    readyCount: 2,
    sharedPhoneWarnings: [],
    duplicatePersonIds: [],
    invalidOverrides: [],
  },
};

const sendResponse = { ok: true, status: 200, data: { success: true, status: 'SENT' } };

const buildRouteImplementation = () =>
  vi.fn(async (path: string) => {
    if (path === '/communication/bulk-recipients') {
      return recipientsResponse;
    }

    if (path === '/communication/message-templates') {
      return templatesResponse;
    }

    if (path === '/communication/preview-template') {
      return previewResponse;
    }

    if (path === '/communication/send') {
      return sendResponse;
    }

    throw new Error(`unexpected route ${path}`);
  });

const setTextarea = (value: string) => {
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('BulkPersonComposer send button wiring', () => {
  beforeEach(() => {
    callAppRoute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('drives one /communication/send per recipient with the confirmed number and text', async () => {
    const implementation = buildRouteImplementation();
    callAppRoute.mockImplementation(implementation);

    await act(async () => {
      render(<BulkPersonComposer personIds={[P1, P2]} />);
    });

    // Wait for recipients to load.
    await waitFor(() => {
      expect(implementation).toHaveBeenCalledWith(
        '/communication/bulk-recipients',
        'POST',
        expect.anything(),
      );
    });

    await act(async () => {
      setTextarea('سلام @name');
    });

    // Preview, so a current valid preview exists.
    await act(async () => {
      screen.getByText('Preview').click();
    });

    await waitFor(() => {
      expect(implementation).toHaveBeenCalledWith(
        '/communication/preview-template',
        'POST',
        expect.anything(),
      );
    });

    // Open the confirmation panel, then send.
    await act(async () => {
      screen.getByText('Review and send').click();
    });

    await act(async () => {
      screen.getByText('Send to each person').click();
    });

    await waitFor(() => {
      const sendCalls = routeCalls().filter(
        (call) => call[0] === '/communication/send',
      );

      expect(sendCalls).toHaveLength(2);
    });

    const sendCalls = routeCalls().filter(
      (call) => call[0] === '/communication/send',
    );

    expect(sendCalls[0][2]).toEqual({
      personId: P1,
      channel: 'SMS',
      recipient: '09120000001',
      body: 'سلام سارا',
    });
    expect(sendCalls[1][2]).toEqual({
      personId: P2,
      channel: 'SMS',
      recipient: '09120000002',
      body: 'سلام رضا',
    });
  });

  it('does not send when the preview is missing (button disabled)', async () => {
    const implementation = buildRouteImplementation();
    callAppRoute.mockImplementation(implementation);

    await act(async () => {
      render(<BulkPersonComposer personIds={[P1, P2]} />);
    });

    await waitFor(() => {
      expect(implementation).toHaveBeenCalledWith(
        '/communication/bulk-recipients',
        'POST',
        expect.anything(),
      );
    });

    const sendButton = screen.getByText('Review and send') as HTMLButtonElement;

    expect(sendButton.disabled).toBe(true);
  });
});
