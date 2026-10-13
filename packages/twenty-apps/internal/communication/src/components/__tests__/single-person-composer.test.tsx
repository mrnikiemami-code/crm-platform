// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub only the SDK runtime hooks; the REAL component and its REAL wiring run.
let locale = 'en';

vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (message: string) => message }),
  useLocale: () => locale,
  enqueueSnackbar: vi.fn(),
  unmountFrontComponent: vi.fn(),
  closeSidePanel: vi.fn(),
}));

const callAppRoute = vi.fn<
  (path: string, method: string, body?: unknown) => Promise<unknown>
>();

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

import { SinglePersonComposer } from 'src/components/single-person-composer';

const PERSON_ID = 'person-1';

const phonesResponse = {
  ok: true,
  status: 200,
  data: {
    success: true,
    phones: [
      { id: 'p-1', value: '09120000001', isPrimary: true },
      { id: 'p-2', value: '09350000002', isPrimary: false },
    ],
    selectedPhone: '09120000001',
  },
};

const templatesResponse = (
  templates: { id: string; title: string; body: string; channel: string }[],
) => ({
  ok: true,
  status: 200,
  data: { success: true, templates, variables: [] },
});

const installRoutes = (templates: unknown) => {
  callAppRoute.mockImplementation(async (path: string) => {
    if (path === '/communication/person-phones') {
      return phonesResponse;
    }

    if (path === '/communication/message-templates') {
      return templates;
    }

    throw new Error(`unexpected route ${path}`);
  });
};

const messageTextarea = (): HTMLTextAreaElement => {
  const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];

  return textareas[textareas.length - 1];
};

// The template picker is the select whose options include the «بدون الگو»
// option — located by content, not by a brittle index.
const templateSelect = (): HTMLSelectElement => {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const found = selects.find((select) =>
    Array.from(select.options).some(
      (option) => option.textContent === 'No template' || option.textContent === 'No templates available' || option.textContent === 'Loading templates…' || option.textContent === 'Unable to load templates.',
    ),
  );

  if (found === undefined) {
    throw new Error('template select not found');
  }

  return found;
};

// The phone picker is the LAST select (it follows channel and template).
const phoneSelect = (): HTMLSelectElement => {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];

  return selects[selects.length - 1];
};

const setTextarea = (value: string) => {
  const textarea = messageTextarea();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

const selectTemplate = (value: string) => {
  const select = templateSelect();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value',
  )?.set;

  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const renderComposer = async () => {
  const result = render(<SinglePersonComposer personId={PERSON_ID} />);

  await act(async () => {
    await Promise.resolve();
  });

  return result;
};

const waitForTemplates = async () => {
  await waitFor(() => {
    expect(
      callAppRoute.mock.calls.some(
        (call) => call[0] === '/communication/message-templates',
      ),
    ).toBe(true);
  });
};

const TEMPLATE_A = {
  id: 't-a',
  title: 'خوش‌آمد',
  body: 'سلام @name عزیز',
  channel: 'SMS',
};

const TEMPLATE_B = {
  id: 't-b',
  title: 'یادآوری',
  body: 'یادآوری برای @company.name',
  channel: 'SMS',
};

describe('SinglePersonComposer — template selector (W17 §C)', () => {
  beforeEach(() => {
    locale = 'en';
    callAppRoute.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('defaults to «بدون الگو» and lists the workspace templates below it', async () => {
    installRoutes(templatesResponse([TEMPLATE_A, TEMPLATE_B]));
    await renderComposer();
    await waitForTemplates();

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];

    expect(templateSelect().value).toBe('');
    expect(screen.getByText('No template')).toBeTruthy();
    expect(screen.getByText('خوش‌آمد')).toBeTruthy();
    expect(screen.getByText('یادآوری')).toBeTruthy();
    expect(selects.length).toBeGreaterThan(0);
  });

  it('populates the message body when a template is chosen, without sending', async () => {
    installRoutes(templatesResponse([TEMPLATE_A]));
    await renderComposer();
    await waitForTemplates();

    await act(async () => {
      selectTemplate('t-a');
    });

    expect(messageTextarea().value).toBe('سلام @name عزیز');
    // No send request was made by choosing a template.
    expect(
      callAppRoute.mock.calls.some((call) => call[0] === '/communication/send'),
    ).toBe(false);
  });

  it('clears the template body when «بدون الگو» is chosen afterwards', async () => {
    installRoutes(templatesResponse([TEMPLATE_A]));
    await renderComposer();
    await waitForTemplates();

    await act(async () => {
      selectTemplate('t-a');
    });
    expect(messageTextarea().value).toBe('سلام @name عزیز');

    await act(async () => {
      selectTemplate('');
    });
    expect(messageTextarea().value).toBe('');
  });

  it('detaches from the template when the body is manually edited (draft only)', async () => {
    installRoutes(templatesResponse([TEMPLATE_A]));
    await renderComposer();
    await waitForTemplates();

    await act(async () => {
      selectTemplate('t-a');
    });

    await act(async () => {
      setTextarea('سلام @name عزیز — متن ویرایش‌شده');
    });

    // The edited text is preserved and the picker is detached.
    expect(messageTextarea().value).toBe(
      'سلام @name عزیز — متن ویرایش‌شده',
    );
    expect(templateSelect().value).toBe('');
  });

  it('still allows a custom message when the workspace has no templates', async () => {
    installRoutes(templatesResponse([]));
    await renderComposer();
    await waitForTemplates();

    await act(async () => {
      setTextarea('پیام دلخواه');
    });

    expect(messageTextarea().value).toBe('پیام دلخواه');
    expect(screen.getByText('No templates available')).toBeTruthy();
  });

  it('still allows a custom message when template loading fails', async () => {
    installRoutes({ ok: false, status: 500, data: {} });
    await renderComposer();
    await waitForTemplates();

    await act(async () => {
      setTextarea('پیام دلخواه');
    });

    expect(messageTextarea().value).toBe('پیام دلخواه');
    expect(screen.getByText('Unable to load templates.')).toBeTruthy();
  });

  it('renders Persian digits in phone LABELS for fa-IR while the value stays ASCII', async () => {
    locale = 'fa-IR';
    installRoutes(templatesResponse([TEMPLATE_A]));
    await renderComposer();
    await waitForTemplates();

    const options = Array.from(phoneSelect().options);

    // The visible label is Persian...
    expect(options[0].textContent).toBe('۰۹۱۲۰۰۰۰۰۰۱');
    // ...but the option VALUE (what a request would carry) is canonical ASCII.
    expect(options[0].value).toBe('09120000001');
    expect(options[1].textContent).toBe('۰۹۳۵۰۰۰۰۰۰۲');
    expect(options[1].value).toBe('09350000002');
  });

  it('renders ASCII phone labels unchanged for en', async () => {
    locale = 'en';
    installRoutes(templatesResponse([TEMPLATE_A]));
    await renderComposer();
    await waitForTemplates();

    expect(phoneSelect().options[0].textContent).toBe('09120000001');
    expect(phoneSelect().options[0].value).toBe('09120000001');
  });
});
