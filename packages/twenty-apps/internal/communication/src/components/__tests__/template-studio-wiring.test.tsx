// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub ONLY the SDK runtime hooks and the external route transport. The REAL
// production `TemplateStudio` component and its REAL helpers run, so this test
// exercises the shipped interaction model rather than a copy of it.
vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (message: string) => message }),
  useLocale: () => 'fa-IR',
}));

type RouteCall = {
  path: string;
  body: Record<string, unknown>;
};

const callAppRoute = vi.fn<
  (
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ) => Promise<unknown>
>();

const routeCalls = (): RouteCall[] =>
  callAppRoute.mock.calls.map((call) => ({
    path: call[0],
    body: (call[2] ?? {}) as Record<string, unknown>,
  }));

const callsFor = (action: string) =>
  routeCalls().filter(
    (call) =>
      call.path === '/communication/template-studio' &&
      call.body?.action === action,
  );

vi.mock('src/components/composer-shared', async () => {
  const actual = await vi.importActual<
    typeof import('src/components/composer-shared')
  >('src/components/composer-shared');

  return {
    ...actual,
    callAppRoute: (
      path: string,
      method: string,
      body?: Record<string, unknown>,
    ) => callAppRoute(path, method, body),
  };
});

import { TemplateStudio } from 'src/components/template-studio.front-component';

const PERSON_FIELD = {
  token: '@person.firstName',
  label: 'نام',
  group: 'PERSON',
};

const COMPANY_FIELD = {
  token: '@company.name',
  label: 'نام شرکت',
  group: 'COMPANY',
};

const TEMPLATE = {
  id: 't1',
  title: 'خوش‌آمد',
  body: 'سلام @person.firstName خوبی؟',
  targetObject: 'PERSON',
};

const listResponse = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  data: {
    success: true,
    templates: [TEMPLATE],
    fields: [PERSON_FIELD, COMPANY_FIELD],
    catalogStatus: 'READY',
    ...overrides,
  },
});

const peopleResponse = {
  ok: true,
  status: 200,
  data: {
    success: true,
    people: [{ id: 'p1', displayName: 'سارا احمدی' }],
  },
};

type Responder = (body: Record<string, unknown>) => unknown;

const installRoutes = ({
  list = listResponse(),
  onPreview,
  onCreate,
}: {
  list?: unknown;
  onPreview?: Responder;
  onCreate?: Responder;
} = {}) => {
  callAppRoute.mockImplementation(
    async (path: string, _method: string, body?: Record<string, unknown>) => {
      if (path !== '/communication/template-studio') {
        throw new Error(`unexpected route ${path}`);
      }

      const action = body?.action;

      if (action === 'list') {
        return list;
      }

      if (action === 'search-people') {
        return peopleResponse;
      }

      if (action === 'preview') {
        return onPreview
          ? onPreview(body ?? {})
          : {
              ok: true,
              status: 200,
              data: {
                success: true,
                previews: [
                  {
                    personId: 'p1',
                    displayName: 'سارا احمدی',
                    phone: '09120000001',
                    previewText: `پیش‌نمایش: ${String(body?.body ?? '')}`,
                    hasUnresolvedVariables: false,
                    issues: [],
                    isReadyToSend: true,
                  },
                ],
                hasUnresolvedVariables: false,
                isBodyEmpty: false,
                readyCount: 1,
              },
            };
      }

      if (action === 'create' || action === 'update') {
        return onCreate
          ? onCreate(body ?? {})
          : {
              ok: true,
              status: 200,
              data: {
                success: true,
                template: {
                  id: 't-new',
                  title: String(body?.title ?? ''),
                  body: String(body?.body ?? ''),
                  targetObject: 'PERSON',
                },
              },
            };
      }

      if (action === 'delete') {
        return {
          ok: true,
          status: 200,
          data: { success: true, deletedId: String(body?.templateId ?? '') },
        };
      }

      throw new Error(`unexpected action ${String(action)}`);
    },
  );
};

const bodyTextarea = (): HTMLTextAreaElement =>
  screen.getByLabelText('Message body') as HTMLTextAreaElement;

const fieldCard = (token: string): HTMLElement => {
  const card = document.querySelector(
    `[data-studio-field-token="${token}"]`,
  ) as HTMLElement | null;

  if (card === null) {
    throw new Error(`field card ${token} not found`);
  }

  return card;
};

/** A minimal DataTransfer stand-in; jsdom does not implement the real one. */
const buildDataTransfer = () => {
  const store = new Map<string, string>();
  const types: string[] = [];

  return {
    types,
    dropEffect: 'none',
    effectAllowed: 'none',
    setData: (format: string, value: string) => {
      store.set(format, value);

      if (!types.includes(format)) {
        types.push(format);
      }
    },
    getData: (format: string) => store.get(format) ?? '',
  };
};

const renderStudio = async () => {
  const result = render(<TemplateStudio />);

  await act(async () => {
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(callsFor('list')).toHaveLength(1);
  });

  return result;
};

const openTemplate = async () => {
  await renderStudio();

  await act(async () => {
    fireEvent.click(screen.getByText('Edit'));
  });

  await waitFor(() => {
    expect(bodyTextarea().value).toBe(TEMPLATE.body);
  });
};

/** Sets a selection, then blurs so the studio remembers it. */
const selectRangeAndBlur = (start: number, end: number) => {
  const textarea = bodyTextarea();

  textarea.focus();
  textarea.setSelectionRange(start, end);
  fireEvent.select(textarea);
  textarea.blur();
};

describe('TemplateStudio — real production component wiring (W18-B)', () => {
  beforeEach(() => {
    callAppRoute.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1: renders the existing templates', async () => {
    installRoutes();
    await renderStudio();

    expect(screen.getByText('خوش‌آمد')).toBeTruthy();
  });

  it('2: New template opens the real editor', async () => {
    installRoutes();
    await renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByText('New template'));
    });

    expect(bodyTextarea().value).toBe('');
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('3: the body is a real multiline textarea', async () => {
    installRoutes();
    await openTemplate();

    const textarea = bodyTextarea();

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(Number(textarea.getAttribute('rows'))).toBeGreaterThan(1);
  });

  it('4: shows the Persian field label AND the technical token', async () => {
    installRoutes();
    await openTemplate();

    expect(
      fieldCard('@person.firstName').textContent,
    ).toContain('نام');
    expect(
      fieldCard('@person.firstName').textContent,
    ).toContain('@person.firstName');
  });

  it('5: a single click selects a field but does NOT insert', async () => {
    installRoutes();
    await openTemplate();

    const before = bodyTextarea().value;

    await act(async () => {
      fireEvent.click(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe(before);
    expect(
      fieldCard('@person.firstName').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('6: double-click inserts EXACTLY ONCE at the remembered caret', async () => {
    installRoutes();
    await renderStudio();

    // The task's own example: a Persian sentence with a gap to fill.
    await act(async () => {
      fireEvent.click(screen.getByText('New template'));
    });

    await act(async () => {
      fireEvent.change(bodyTextarea(), { target: { value: 'سلام  خوبی؟' } });
    });

    // Caret in the gap → index 5.
    selectRangeAndBlur(5, 5);

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@person.firstName'));
    });

    const value = bodyTextarea().value;
    const occurrences = value.split('@person.firstName').length - 1;

    expect(value).toBe('سلام @person.firstName خوبی؟');
    expect(occurrences).toBe(1);
  });

  it('6b: the click half of a double-click never inserts on its own', async () => {
    installRoutes();
    await openTemplate();

    const before = bodyTextarea().value;

    // Two clicks, no double-click: selection only.
    await act(async () => {
      fireEvent.click(fieldCard('@person.firstName'));
      fireEvent.click(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe(before);
  });

  it('7: drag and drop inserts EXACTLY ONCE', async () => {
    installRoutes();
    await openTemplate();

    const dataTransfer = buildDataTransfer();

    await act(async () => {
      fireEvent.dragStart(fieldCard('@company.name'), { dataTransfer });
      fireEvent.drop(bodyTextarea(), { dataTransfer });
    });

    const value = bodyTextarea().value;
    const occurrences = value.split('@company.name').length - 1;

    expect(occurrences).toBe(1);
  });

  it('8: selected text is replaced by the inserted token', async () => {
    installRoutes();
    await openTemplate();

    // Replace the '@person.firstName' that the template already contains.
    const start = TEMPLATE.body.indexOf('@person.firstName');

    selectRangeAndBlur(start, start + '@person.firstName'.length);

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@company.name'));
    });

    expect(bodyTextarea().value).toBe('سلام @company.name خوبی؟');
  });

  it('9: newlines and surrounding Persian text are preserved', async () => {
    installRoutes();
    await renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByText('New template'));
    });

    await act(async () => {
      fireEvent.change(bodyTextarea(), {
        target: { value: 'خط اول\nخط دوم\nخط سوم' },
      });
    });

    // Caret at the end of the first line (index 6, before the newline).
    selectRangeAndBlur(6, 6);

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe(
      'خط اول@person.firstName\nخط دوم\nخط سوم',
    );
    expect(bodyTextarea().value.split('\n')).toHaveLength(3);
  });

  it('10: Save sends the canonical title, body and targetObject', async () => {
    installRoutes();
    await renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByText('New template'));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'الگوی تست' },
      });
      fireEvent.change(bodyTextarea(), {
        target: { value: 'سلام @person.firstName خوبی؟' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(callsFor('create')).toHaveLength(1);
    });

    // The CANONICAL token is stored — never the Persian label — and the target
    // is the stable machine value.
    expect(callsFor('create')[0].body).toEqual({
      action: 'create',
      templateId: null,
      title: 'الگوی تست',
      body: 'سلام @person.firstName خوبی؟',
      targetObject: 'PERSON',
    });
  });

  it('11: the sample-person preview displays the resolved text', async () => {
    installRoutes();
    await openTemplate();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Search people'), {
        target: { value: 'سارا' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Sample person'), {
        target: { value: 'p1' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Preview'));
    });

    await waitFor(() => {
      expect(callsFor('preview')).toHaveLength(1);
    });

    expect(
      screen.getByText(`پیش‌نمایش: ${TEMPLATE.body}`),
    ).toBeTruthy();
  });

  it('12: editing the body invalidates the shown preview', async () => {
    installRoutes();
    await openTemplate();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Sample person'), {
        target: { value: 'p1' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Preview'));
    });

    await waitFor(() => {
      expect(screen.getByText(`پیش‌نمایش: ${TEMPLATE.body}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.change(bodyTextarea(), { target: { value: 'متن جدید' } });
    });

    expect(screen.queryByText(`پیش‌نمایش: ${TEMPLATE.body}`)).toBeNull();
  });

  it('13: an unauthorized or stale dropped token changes nothing', async () => {
    installRoutes();
    await openTemplate();

    const before = bodyTextarea().value;
    const dataTransfer = buildDataTransfer();

    // Hand-crafted payload that is NOT in the authorized catalog.
    dataTransfer.setData('text/plain', '@person.notAuthorized');

    await act(async () => {
      fireEvent.drop(bodyTextarea(), { dataTransfer });
    });

    expect(bodyTextarea().value).toBe(before);
  });

  it('14: a late preview response is ignored after unmount', async () => {
    let releasePreview: ((value: unknown) => void) | null = null;

    installRoutes({
      onPreview: () =>
        new Promise((resolve) => {
          releasePreview = resolve;
        }),
    });

    const { unmount } = await renderStudio();

    await act(async () => {
      fireEvent.click(screen.getByText('Edit'));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Sample person'), {
        target: { value: 'p1' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Preview'));
    });

    unmount();

    // Resolving AFTER unmount must not publish anything (and must not throw).
    await act(async () => {
      releasePreview?.({
        ok: true,
        status: 200,
        data: {
          success: true,
          previews: [
            {
              personId: 'p1',
              displayName: 'سارا احمدی',
              phone: '09120000001',
              previewText: 'دیرهنگام',
              hasUnresolvedVariables: false,
              issues: [],
              isReadyToSend: true,
            },
          ],
          hasUnresolvedVariables: false,
          isBodyEmpty: false,
          readyCount: 1,
        },
      });
    });

    expect(screen.queryByText('دیرهنگام')).toBeNull();
  });

  it('15: no SMS or send route is ever called', async () => {
    installRoutes();
    await openTemplate();

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@company.name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    const paths = routeCalls().map((call) => call.path);

    expect(paths.every((path) => path === '/communication/template-studio')).toBe(
      true,
    );
    expect(paths).not.toContain('/communication/send');
    expect(paths).not.toContain('/communication/preview-template');
  });

  it('16: shows the catalog-unavailable state and disables preview', async () => {
    installRoutes({
      list: listResponse({ fields: [], catalogStatus: 'UNAVAILABLE' }),
    });

    await openTemplate();

    expect(
      screen.getAllByText('Authorized variables are unavailable right now.').length,
    ).toBeGreaterThan(0);
    // The button is still rendered, but disabled — the gate is explicit.
    expect((screen.getByText('Preview') as HTMLButtonElement).disabled).toBe(
      true,
    );
    // No preview may be requested while the catalog is unavailable.
    expect(callsFor('preview')).toHaveLength(0);
  });
});
