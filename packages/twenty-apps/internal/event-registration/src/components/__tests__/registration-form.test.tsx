// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The host SDK is replaced by plain functions: the point of this test is the
// form's own behaviour (what it sends and what it refuses), not the sandbox.
const callAppRoute = vi.fn();
const enqueueSnackbar = vi.fn();
const closeSidePanel = vi.fn();

vi.mock('twenty-sdk/front-component', () => ({
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext: (
    selector: (context: unknown) => unknown,
  ) =>
    selector({
      selectedRecordIds: ['lead-1'],
      objectNameSingular: 'eventLead',
    }),
}));

vi.mock('src/components/registration-api', () => ({
  PREPARE_ROUTE: '/event-registration/prepare',
  SAVE_ROUTE: '/event-registration/save',
  callAppRoute,
}));

const { RegistrationForm } = await import(
  'src/components/registration-form'
);

const PREPARE_OK = {
  data: {
    success: true,
    leadId: 'lead-1',
    leadName: 'ساسان نیک پور',
    personId: 'person-1',
    personName: 'ساسان نیک پور',
    eventId: 'event-1',
    eventName: 'همایش آذر ماه',
    performedByName: null,
    existingRegistration: null,
  },
};

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const setNativeValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const clickButton = (label: string) => {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => (candidate.textContent ?? '').includes(label),
  );

  if (button === undefined) {
    throw new Error(`no button containing "${label}"`);
  }

  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

let container: HTMLDivElement;

beforeEach(async () => {
  callAppRoute.mockReset();
  enqueueSnackbar.mockReset();
  closeSidePanel.mockReset();
  callAppRoute.mockResolvedValue(PREPARE_OK);

  container = document.createElement('div');
  document.body.append(container);

  await act(async () => {
    createRoot(container).render(<RegistrationForm />);
  });
  await flush();
});

afterEach(() => {
  container.remove();
});

const agreedInput = () =>
  document.querySelector<HTMLInputElement>('#registration-agreed')!;
const paidInput = () =>
  document.querySelector<HTMLInputElement>('#registration-paid')!;

describe('RegistrationForm — amount entry', () => {
  it('refuses 125000.00 instead of turning it into 12,500,000', async () => {
    await act(async () => {
      setNativeValue(agreedInput(), '125000.00');
    });

    expect(document.body.textContent).toContain('ممیز مجاز نیست');
    // The typed text stays visible and unchanged; it is never rewritten.
    expect(agreedInput().value).toBe('125000.00');
    expect(agreedInput().value).not.toBe('12٬500٬000');
  });

  it('does not send anything while the amount is unreadable', async () => {
    await act(async () => {
      setNativeValue(agreedInput(), '125000.00');
      setNativeValue(paidInput(), '125000.00');
    });

    await act(async () => {
      clickButton('ذخیره ثبت‌نام');
    });
    await flush();

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
    // Only the prefill call reached the server.
    expect(callAppRoute).toHaveBeenCalledTimes(1);
    expect(callAppRoute.mock.calls[0][0]).toBe('/event-registration/prepare');
  });

  it('groups 125,000 typed with Persian digits as 125 thousand', async () => {
    await act(async () => {
      setNativeValue(agreedInput(), '۱۲۵۰۰۰');
    });

    // The digits normalise to ASCII while the grouping is the Persian one, and
    // the value is 125 thousand — not millions.
    expect(agreedInput().value.replace(/\D/g, '')).toBe('125000');
    expect(agreedInput().value).toBe('125٬000');
  });

  it('groups 125,000 typed with ASCII digits', async () => {
    await act(async () => {
      setNativeValue(paidInput(), '125000');
    });

    expect(paidInput().value).toBe('125٬000');
  });
});

describe('RegistrationForm — confirmation before writing', () => {
  const fillBothFields = async () => {
    await act(async () => {
      setNativeValue(agreedInput(), '۱۲۵۰۰۰');
      setNativeValue(paidInput(), '125000');
    });
    await act(async () => {
      clickButton('ذخیره ثبت‌نام');
    });
    await flush();
  };

  it('shows both amounts and writes nothing until confirmed', async () => {
    await fillBothFields();

    const text = document.body.textContent ?? '';

    expect(text).toContain('تأیید مبلغ پیش از ذخیره');
    expect(text).toContain('۱۲۵٬۰۰۰ تومان');
    expect(text).toContain('تأیید و ذخیره');
    // Still only the prepare call.
    expect(callAppRoute).toHaveBeenCalledTimes(1);
  });

  it('sends exactly 125000 for both amounts after confirmation', async () => {
    await fillBothFields();

    callAppRoute.mockResolvedValueOnce({
      data: {
        outcome: {
          kind: 'CREATED',
          registrationId: 'registration-1',
          paymentId: 'payment-1',
        },
      },
    });

    await act(async () => {
      clickButton('تأیید و ذخیره');
    });
    await flush();

    expect(callAppRoute).toHaveBeenCalledTimes(2);

    const [route, body] = callAppRoute.mock.calls[1];

    expect(route).toBe('/event-registration/save');
    expect(body.agreedAmountToman).toBe(125000);
    expect(body.paidAmountToman).toBe(125000);
  });

  it('keeps the registration id on screen when the payment fails', async () => {
    await fillBothFields();

    callAppRoute.mockResolvedValueOnce({
      data: {
        outcome: {
          kind: 'REGISTERED_BUT_PAYMENT_FAILED',
          registrationId: 'registration-9',
          message: 'The registration is saved but the payment is not recorded.',
        },
      },
    });

    await act(async () => {
      clickButton('تأیید و ذخیره');
    });
    await flush();

    const text = document.body.textContent ?? '';

    expect(text).toContain('ثبت‌نام ذخیره شد، پرداخت نه');
    expect(text).toContain('registration-9');
    // A blind retry would duplicate the registration, so no save button is left.
    expect(text).not.toContain('تأیید و ذخیره');
  });

  it('reports a duplicate instead of creating a second registration', async () => {
    await fillBothFields();

    callAppRoute.mockResolvedValueOnce({
      data: {
        outcome: {
          kind: 'ALREADY_REGISTERED',
          registrationId: 'registration-5',
        },
      },
    });

    await act(async () => {
      clickButton('تأیید و ذخیره');
    });
    await flush();

    expect(document.body.textContent).toContain('قبلاً ثبت‌نام شده است');
    expect(callAppRoute).toHaveBeenCalledTimes(2);
  });

  it('sends no payment when the paid field is zero', async () => {
    await act(async () => {
      setNativeValue(agreedInput(), '125000');
    });
    await act(async () => {
      clickButton('ذخیره ثبت‌نام');
    });
    await flush();

    expect(document.body.textContent).toContain('بدون پرداخت');

    callAppRoute.mockResolvedValueOnce({
      data: {
        outcome: {
          kind: 'CREATED',
          registrationId: 'registration-2',
          paymentId: null,
        },
      },
    });

    await act(async () => {
      clickButton('تأیید و ذخیره');
    });
    await flush();

    const [, body] = callAppRoute.mock.calls[1];

    expect(body.agreedAmountToman).toBe(125000);
    expect(body.paidAmountToman).toBe(0);
  });

  it('drops the confirmation when a value changes afterwards', async () => {
    await fillBothFields();

    await act(async () => {
      setNativeValue(agreedInput(), '125001');
    });

    expect(document.body.textContent).not.toContain('تأیید مبلغ پیش از ذخیره');
  });
});
