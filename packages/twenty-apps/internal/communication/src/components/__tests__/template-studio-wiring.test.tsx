// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub ONLY the SDK runtime hooks and the external route transport. The REAL
// production `TemplateStudio` and its REAL helpers run, so this test exercises
// the shipped table/modal/combobox behavior rather than a copy of it.
vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (message: string) => message }),
  useLocale: () => 'fa-IR',
}));

const callAppRoute = vi.fn<
  (
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ) => Promise<unknown>
>();

const routeCalls = () =>
  callAppRoute.mock.calls.map((call) => ({
    path: call[0],
    body: (call[2] ?? {}) as Record<string, unknown>,
  }));

const callsFor = (action: string) =>
  routeCalls().filter(
    (call) =>
      call.path === '/communication/template-studio' &&
      call.body.action === action,
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
  label: 'First name',
  group: 'PERSON',
};

const COMPANY_FIELD = {
  token: '@company.name',
  label: 'Company name',
  group: 'COMPANY',
};

const TEMPLATE = {
  id: 't1',
  title: 'Greeting',
  body: 'سلام @person.firstName خوبی؟',
  targetObject: 'PERSON',
  updatedAt: '2026-10-14T06:00:00.000Z',
};

const SECOND_TEMPLATE = {
  id: 't2',
  title: 'Reminder',
  body: 'یادآوری',
  targetObject: 'PERSON',
  updatedAt: '2026-10-13T05:00:00.000Z',
};

const listResponse = (
  templates: unknown[] = [TEMPLATE, SECOND_TEMPLATE],
  overrides: Record<string, unknown> = {},
) => ({
  ok: true,
  status: 200,
  data: {
    success: true,
    templates,
    fields: [PERSON_FIELD, COMPANY_FIELD],
    catalogStatus: 'READY',
    catalogStage: 'OK',
    ...overrides,
  },
});

const peopleResponse = {
  ok: true,
  status: 200,
  data: {
    success: true,
    people: [
      { id: 'p1', displayName: 'سارا احمدی' },
      { id: 'p2', displayName: 'رضا کریمی' },
    ],
  },
};

const previewResponse = (body: unknown, personId: string) => ({
  ok: true,
  status: 200,
  data: {
    success: true,
    previews: [
      {
        personId,
        displayName: 'سارا احمدی',
        phone: '09120000001',
        previewText: `پیش‌نمایش: ${String(body ?? '')}`,
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

let listPayload: unknown = listResponse();

const installRoutes = ({
  onPreview,
}: {
  onPreview?: (body: Record<string, unknown>) => unknown;
} = {}) => {
  callAppRoute.mockImplementation(
    async (path: string, _method: string, body?: Record<string, unknown>) => {
      if (path !== '/communication/template-studio') {
        throw new Error(`unexpected route ${path}`);
      }

      switch (body?.action) {
        case 'list':
          return listPayload;
        case 'search-people':
          return peopleResponse;
        case 'preview':
          return onPreview
            ? onPreview(body)
            : previewResponse(body?.body, String(body?.personId));
        case 'create':
        case 'update':
          return {
            ok: true,
            status: 200,
            data: {
              success: true,
              template: {
                id: 't-new',
                title: String(body?.title ?? ''),
                body: String(body?.body ?? ''),
                targetObject: 'PERSON',
                updatedAt: '2026-10-14T07:00:00.000Z',
              },
            },
          };
        case 'delete':
          return {
            ok: true,
            status: 200,
            data: { success: true, deletedId: String(body?.templateId ?? '') },
          };
        default:
          throw new Error(`unexpected action ${String(body?.action)}`);
      }
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

const openCreateModal = async () => {
  await renderStudio();

  await act(async () => {
    fireEvent.click(screen.getByText('Create new template'));
  });
};

const openEditModal = async (title = 'Greeting') => {
  await renderStudio();

  const row = screen.getByText(title).closest('tr') as HTMLTableRowElement;

  await act(async () => {
    fireEvent.click(within(row).getByText('Edit'));
  });
};

/** Moves the caret and lets the component remember it, as a user would. */
const placeCaret = (start: number, end = start) => {
  const textarea = bodyTextarea();

  textarea.focus();
  textarea.setSelectionRange(start, end);
  fireEvent.select(textarea);
};

/**
 * Drives the Person combobox the way a user does. Each event gets its own `act`
 * so React has re-rendered before the next key is handled — batching them into
 * one `act` would let the arrow key act on stale options.
 */
const selectSamplePerson = async (query: string) => {
  const input = screen.getByLabelText('Sample person') as HTMLInputElement;

  await act(async () => {
    fireEvent.focus(input);
  });

  await act(async () => {
    fireEvent.change(input, { target: { value: query } });
  });

  await act(async () => {
    fireEvent.keyDown(input, { key: 'ArrowDown' });
  });

  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });

  return input;
};

const samplePersonInput = (): HTMLInputElement =>
  screen.getByLabelText('Sample person') as HTMLInputElement;

const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('TemplateStudio — table, modal and combobox wiring (W19-A)', () => {
  beforeEach(() => {
    callAppRoute.mockReset();
    listPayload = listResponse();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('1: renders the Persian table with the expected columns and rows', async () => {
    installRoutes();
    await renderStudio();

    expect(screen.getByText('SMS template management')).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((cell) =>
      cell.textContent?.trim(),
    );

    expect(headers).toEqual(['Title', 'Target entity', 'Last update', 'Actions']);
    expect(screen.getByText('Greeting')).toBeTruthy();
    expect(screen.getByText('Reminder')).toBeTruthy();
    // The target shows the adapter label, never the raw stored value.
    expect(screen.getAllByText('People').length).toBeGreaterThan(0);
    // The last-update column shows the date portion of the ISO timestamp.
    expect(screen.getByText('2026-10-14')).toBeTruthy();
  });

  it('2: search filters the table by title', async () => {
    installRoutes();
    await renderStudio();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search by title'), {
        target: { value: 'Reminder' },
      });
    });

    expect(screen.getByText('Reminder')).toBeTruthy();
    expect(screen.queryByText('Greeting')).toBeNull();
  });

  it('3: shows the empty state when the workspace has no templates', async () => {
    listPayload = listResponse([]);
    installRoutes();
    await renderStudio();

    expect(screen.getByText('No templates yet.')).toBeTruthy();
  });

  it('4: shows the sanitized error state when the list fails', async () => {
    listPayload = { ok: false, status: 500, data: {} };
    installRoutes();
    await renderStudio();

    expect(screen.getByText('Templates could not be loaded.')).toBeTruthy();
  });

  it('5: the create modal opens with the editor, target combobox and fields', async () => {
    installRoutes();
    await openCreateModal();

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(bodyTextarea().tagName).toBe('TEXTAREA');
    expect(bodyTextarea().getAttribute('dir')).toBe('rtl');
    expect(screen.getByLabelText('Target entity')).toBeTruthy();
    expect(fieldCard('@person.firstName')).toBeTruthy();
  });

  it('6: the edit modal loads the EXACT saved values', async () => {
    installRoutes();
    await openEditModal();

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(
      'Greeting',
    );
    expect(bodyTextarea().value).toBe(TEMPLATE.body);
  });

  it('7: the field shows the Persian label and an LTR, bidi-isolated token', async () => {
    installRoutes();
    await openCreateModal();

    const card = fieldCard('@person.firstName');

    expect(card.textContent).toContain('First name');

    const token = card.querySelector(
      'span[style*="direction: ltr"], span[style*="direction:ltr"]',
    ) as HTMLElement | null;

    // The token element forces LTR with bidi isolation, so it always READS as
    // `@person.firstName` even inside the RTL panel.
    expect(token).not.toBeNull();
    expect(token?.textContent).toBe('@person.firstName');
    expect(token?.style.direction).toBe('ltr');
    expect(token?.style.unicodeBidi).toBe('isolate');
  });

  it('8: field search matches the Persian label and the technical token', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search fields'), {
        target: { value: 'company' },
      });
    });

    expect(fieldCard('@company.name')).toBeTruthy();
    expect(
      document.querySelector('[data-studio-field-token="@person.firstName"]'),
    ).toBeNull();
  });

  it('9: a single click selects a field but does NOT insert', async () => {
    installRoutes();
    await openCreateModal();

    const before = bodyTextarea().value;

    await act(async () => {
      fireEvent.click(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe(before);
    expect(
      fieldCard('@person.firstName').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('10: double-click inserts the canonical token EXACTLY ONCE at the caret', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام  خوبی؟');
    });

    act(() => {
      placeCaret(5);
    });

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@person.firstName'));
    });

    const value = bodyTextarea().value;

    expect(value).toBe('سلام @person.firstName خوبی؟');
    expect(value.split('@person.firstName').length - 1).toBe(1);
  });

  it('11: Enter on a focused field inserts exactly once', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام  خوبی؟');
    });

    act(() => {
      placeCaret(5);
    });

    await act(async () => {
      fireEvent.keyDown(fieldCard('@company.name'), { key: 'Enter' });
    });

    expect(bodyTextarea().value).toBe('سلام @company.name خوبی؟');
  });

  it('12: newlines and surrounding Persian text are preserved', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'خط اول\nخط دوم');
    });

    act(() => {
      placeCaret(6);
    });

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe('خط اول@person.firstName\nخط دوم');
    expect(bodyTextarea().value.split('\n')).toHaveLength(2);
  });

  it('13: a drop with NO dataTransfer does not crash and changes nothing', async () => {
    installRoutes();
    await openCreateModal();

    const before = bodyTextarea().value;

    await act(async () => {
      // jsdom/React hand us an event whose `dataTransfer` is undefined; the
      // handlers must never dereference it.
      fireEvent.drop(bodyTextarea());
      fireEvent.dragOver(bodyTextarea());
    });

    expect(bodyTextarea().value).toBe(before);
  });

  it('14: the drag fallback inserts the remembered token exactly once', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام  خوبی؟');
    });

    act(() => {
      placeCaret(5);
    });

    await act(async () => {
      // No payload at all: only the locally remembered drag token can be used.
      fireEvent.dragStart(fieldCard('@person.firstName'));
      fireEvent.drop(bodyTextarea());
    });

    const value = bodyTextarea().value;

    expect(value).toBe('سلام @person.firstName خوبی؟');
    expect(value.split('@person.firstName').length - 1).toBe(1);
  });

  it('15: an unauthorized dropped token is ignored', async () => {
    installRoutes();
    await openCreateModal();

    const before = bodyTextarea().value;
    const dataTransfer = buildDataTransfer();

    dataTransfer.setData('text/plain', '@person.notAuthorized');

    await act(async () => {
      fireEvent.drop(bodyTextarea(), { dataTransfer });
    });

    expect(bodyTextarea().value).toBe(before);
  });

  it('16: a typed drop payload inserts once', async () => {
    installRoutes();
    await openCreateModal();

    const dataTransfer = buildDataTransfer();

    await act(async () => {
      fireEvent.dragStart(fieldCard('@company.name'), { dataTransfer });
      fireEvent.drop(bodyTextarea(), { dataTransfer });
    });

    expect(bodyTextarea().value.split('@company.name').length - 1).toBe(1);
  });

  it('17: the unsaved guard blocks Escape until the change is discarded', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Draft' },
      });
    });

    const dialog = screen.getByRole('dialog');

    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });

    // Still open, and now offering the confirmation.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('This template has unsaved changes.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Keep editing'));
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.queryByText('This template has unsaved changes.'),
    ).toBeNull();
  });

  it('18: Escape closes a clean modal immediately', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('19: Save sends the canonical payload, closes the modal and refreshes the table', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'الگوی تست' },
      });
      setNativeValue(bodyTextarea(), 'سلام @person.firstName خوبی؟');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    await waitFor(() => {
      expect(callsFor('create')).toHaveLength(1);
    });

    const payload = callsFor('create')[0].body;

    // Canonical token, stable target, no label, no hidden bidi controls.
    expect(payload).toEqual({
      action: 'create',
      templateId: null,
      title: 'الگوی تست',
      body: 'سلام @person.firstName خوبی؟',
      targetObject: 'PERSON',
    });
    expect(
      /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/.test(
        String(payload.body),
      ),
    ).toBe(false);

    await waitFor(() => {
      expect(callsFor('list')).toHaveLength(2);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('20: validation blocks a save with a Persian message', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(screen.getByText('A title is required.')).toBeTruthy();
    expect(callsFor('create')).toHaveLength(0);
    expect(callsFor('update')).toHaveLength(0);
  });

  it('21: the Person combobox filters, navigates with arrows and selects with Enter', async () => {
    installRoutes();
    await openCreateModal();

    const input = samplePersonInput();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.value).toBe('');

    await act(async () => {
      fireEvent.focus(input);
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'سارا' } });
    });

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe('سارا احمدی');

    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });

    expect(
      screen.getAllByRole('option')[0].getAttribute('aria-selected'),
    ).toBe('true');

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // The selection is visible once the list closes.
    expect(input.value).toBe('سارا احمدی');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('22: the Person combobox has a clear action and no default selection', async () => {
    installRoutes();
    await openCreateModal();

    const personBox = () =>
      samplePersonInput().parentElement as HTMLElement;

    expect(samplePersonInput().value).toBe('');
    // The Person picker starts with nothing selected, so it offers no clear
    // action (the target picker legitimately has one).
    expect(within(personBox()).queryByLabelText('Clear')).toBeNull();

    await selectSamplePerson('رضا');

    expect(samplePersonInput().value).toBe('رضا کریمی');

    await act(async () => {
      fireEvent.click(within(personBox()).getByLabelText('Clear'));
    });

    expect(samplePersonInput().value).toBe('');
  });

  it('23: the preview gate stays closed until a person AND a body exist', async () => {
    installRoutes();
    await openCreateModal();

    const previewButton = () =>
      screen.getByText('Preview').closest('button') as HTMLButtonElement;

    expect(previewButton().disabled).toBe(true);

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام');
    });

    expect(previewButton().disabled).toBe(true);

    await selectSamplePerson('سارا');

    expect(previewButton().disabled).toBe(false);
  });

  it('24: preview shows the resolved text and is invalidated by a body edit', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام');
    });

    await selectSamplePerson('سارا');

    await act(async () => {
      fireEvent.click(screen.getByText('Preview'));
    });

    await waitFor(() => {
      expect(callsFor('preview')).toHaveLength(1);
    });

    expect(screen.getByText('پیش‌نمایش: سلام')).toBeTruthy();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'متن جدید');
    });

    expect(screen.queryByText('پیش‌نمایش: سلام')).toBeNull();
  });

  it('25: a late preview response cannot publish after unmount', async () => {
    let release: ((value: unknown) => void) | null = null;

    installRoutes({
      onPreview: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });

    const { unmount } = render(<TemplateStudio />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Create new template'));
    });

    await act(async () => {
      setNativeValue(bodyTextarea(), 'سلام');
    });

    await selectSamplePerson('سارا');

    await act(async () => {
      fireEvent.click(screen.getByText('Preview'));
    });

    unmount();

    await act(async () => {
      release?.({
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

  it('26: delete asks for confirmation and then removes the row', async () => {
    installRoutes();
    await renderStudio();

    const row = screen.getByText('Greeting').closest('tr') as HTMLTableRowElement;

    await act(async () => {
      fireEvent.click(within(row).getByText('Delete'));
    });

    expect(screen.getByText(/Delete this template permanently\?/)).toBeTruthy();

    await act(async () => {
      const dialog = screen.getByRole('dialog');

      fireEvent.click(within(dialog).getByText('Delete'));
    });

    await waitFor(() => {
      expect(callsFor('delete')).toHaveLength(1);
    });

    expect(callsFor('delete')[0].body).toEqual({
      action: 'delete',
      templateId: 't1',
    });
  });

  it('27: the catalog-unavailable state hides the fields and blocks preview', async () => {
    listPayload = listResponse([TEMPLATE], {
      fields: [],
      catalogStatus: 'UNAVAILABLE',
      catalogStage: 'READ_ONLY_PROBE_FAILED',
    });
    installRoutes();
    await openCreateModal();

    expect(
      screen.getAllByText('Authorized variables are unavailable right now.')
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Preview').closest('button')).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByLabelText('Sample person')).toBeNull();
  });

  it('29: uses the REMEMBERED caret after the textarea blurs and resets its range', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      setNativeValue(bodyTextarea(), 'ABCDEF');
    });

    act(() => {
      placeCaret(2);
    });

    // A real browser resets selectionStart/End to the END of the value on blur,
    // which is exactly what made the caret look like it was ignored.
    const textarea = bodyTextarea();

    textarea.setSelectionRange(6, 6);
    textarea.blur();

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@person.firstName'));
    });

    expect(bodyTextarea().value).toBe('AB@person.firstNameCDEF');
  });

  it('30: clicks anywhere inside the dialog keep it open', async () => {
    installRoutes();
    await openCreateModal();

    const dialog = screen.getByRole('dialog');

    // Every interactive surface a user could click: the header, the title input,
    // the target combobox, the field cards, the body, the palette and the
    // preview control.
    const targets: Element[] = [
      dialog,
      screen.getByLabelText('Title'),
      screen.getByLabelText('Target entity'),
      screen.getByLabelText('Message body'),
      screen.getByLabelText('Search fields'),
      fieldCard('@person.firstName'),
      screen.getByText('Sample preview'),
      screen.getByText('Save').closest('button') as Element,
    ];

    for (const target of targets) {
      await act(async () => {
        fireEvent.click(target);
        fireEvent.mouseDown(target);
      });

      expect(screen.queryByRole('dialog')).toBeTruthy();
    }
  });

  it('31: an actual backdrop click respects the unsaved-change guard', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Dirty' },
      });
    });

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;

    await act(async () => {
      fireEvent.click(backdrop);
    });

    // The dialog is still mounted and now asks before discarding.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('This template has unsaved changes.')).toBeTruthy();
  });

  it('32: Escape inside an open combobox closes only the list', async () => {
    installRoutes();
    await openCreateModal();

    const input = samplePersonInput();

    await act(async () => {
      fireEvent.focus(input);
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'سارا' } });
    });

    expect(screen.getByRole('listbox')).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    // The list is gone, the editor is not.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('33: the sample-Person combobox selects by MOUSE', async () => {
    installRoutes();
    await openCreateModal();

    const input = samplePersonInput();

    await act(async () => {
      fireEvent.focus(input);
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'رضا' } });
    });

    const option = screen.getAllByRole('option')[0];

    await act(async () => {
      fireEvent.mouseDown(option);
      fireEvent.click(option);
    });

    expect(samplePersonInput().value).toBe('رضا کریمی');
  });

  it('34: the combobox shows loading and empty states', async () => {
    let releasePeople: ((value: unknown) => void) | null = null;

    callAppRoute.mockImplementation(
      async (path: string, _method: string, body?: Record<string, unknown>) => {
        switch (body?.action) {
          case 'list':
            return listPayload;
          case 'search-people':
            return new Promise((resolve) => {
              releasePeople = resolve;
            });
          default:
            return { ok: true, status: 200, data: { success: true } };
        }
      },
    );

    await openCreateModal();

    const input = samplePersonInput();

    await act(async () => {
      fireEvent.focus(input);
    });

    // Still fetching: the list reports loading rather than pretending to be empty.
    expect(screen.getByText('Loading people…')).toBeTruthy();

    await act(async () => {
      releasePeople?.({
        ok: true,
        status: 200,
        data: { success: true, people: [] },
      });
    });

    expect(screen.getByText('No matching person.')).toBeTruthy();
  });

  it('35: the modal exposes a bounded scrolling body and bounded list regions', async () => {
    installRoutes();
    await openCreateModal();

    const dialog = screen.getByRole('dialog');

    // The dialog itself never scrolls; a bounded inner row does.
    const scrollingRows = Array.from(dialog.querySelectorAll('div')).filter(
      (element) => element.style.overflowY === 'auto',
    );

    expect(scrollingRows.length).toBeGreaterThan(0);
    expect(dialog.style.overflow).toBe('hidden');

    // The modal is height-bounded in viewport units, and the palette and the
    // combobox list each carry their own maximum height.
    expect(dialog.style.height.length).toBeGreaterThan(0);
    expect(dialog.style.maxHeight.length).toBeGreaterThan(0);

    const bounded = Array.from(dialog.querySelectorAll('*')).filter(
      (element) =>
        (element as HTMLElement).style.maxHeight.length > 0 &&
        (element as HTMLElement).style.overflowY === 'auto',
    );

    expect(bounded.length).toBeGreaterThanOrEqual(1);
  });

  it('36: a Tab press at the cycle edge never throws on a non-focusable value', async () => {
    installRoutes();
    await openCreateModal();

    const dialog = screen.getByRole('dialog');

    // The renderer may return values without `focus`; the trap must survive.
    await expect(
      act(async () => {
        fireEvent.keyDown(dialog, { key: 'Tab' });
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      }),
    ).resolves.not.toThrow();

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('28: no SMS or send route is ever called', async () => {
    installRoutes();
    await openCreateModal();

    await act(async () => {
      fireEvent.doubleClick(fieldCard('@company.name'));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'x' },
      });
      fireEvent.click(screen.getByText('Save'));
    });

    const paths = routeCalls().map((call) => call.path);

    expect(
      paths.every((path) => path === '/communication/template-studio'),
    ).toBe(true);
    expect(paths).not.toContain('/communication/send');
  });
});
