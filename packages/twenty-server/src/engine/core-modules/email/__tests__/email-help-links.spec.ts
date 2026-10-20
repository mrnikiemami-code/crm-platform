import {
  BillingTrialEndingEmail,
  PasswordResetLinkEmail,
  PasswordUpdateNotifyEmail,
  SendEmailVerificationLinkEmail,
  renderEmail,
} from 'twenty-emails';

// Real HTML render of production email templates, not just footer props.
// Regression guard: BI-01 review R2 — a mail client cannot resolve a relative
// `/help`, so every production template must emit an absolute same-installation
// Help URL or omit the Help links entirely.
const PUBLISHED_ORIGIN = 'https://crm.customer.example';

const helpHrefPattern = /href="([^"]*\/help[^"]*)"/g;

const renderedHelpHrefs = (html: string): string[] =>
  Array.from(html.matchAll(helpHrefPattern), (match) => match[1]);

describe('email Help links', () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.useFakeTimers();
  });

  describe('with a validated published origin', () => {
    it('renders absolute Help URLs in the password reset email', async () => {
      const html = await renderEmail(
        PasswordResetLinkEmail({
          duration: '5 minutes',
          hasPassword: true,
          link: 'https://crm.customer.example/reset-password?token=abc',
          locale: 'en',
          serverUrl: PUBLISHED_ORIGIN,
        }),
      );

      const helpHrefs = renderedHelpHrefs(html);

      expect(helpHrefs.length).toBeGreaterThan(0);
      for (const href of helpHrefs) {
        expect(href).toBe(`${PUBLISHED_ORIGIN}/help`);
      }
      expect(html).toContain('/reset-password?token=abc');
      expect(html).not.toMatch(/docs\.twenty\.com/);
    });

    it('renders absolute Help URLs in the email verification email', async () => {
      const html = await renderEmail(
        SendEmailVerificationLinkEmail({
          link: 'https://crm.customer.example/verify-email?token=abc',
          locale: 'en',
          serverUrl: PUBLISHED_ORIGIN,
        }),
      );

      expect(renderedHelpHrefs(html)).toEqual([
        `${PUBLISHED_ORIGIN}/help`,
        `${PUBLISHED_ORIGIN}/help`,
      ]);
    });

    it('renders absolute Help URLs in the password update notification', async () => {
      const html = await renderEmail(
        PasswordUpdateNotifyEmail({
          userName: 'Tim Apple',
          email: 'tim@customer.example',
          link: PUBLISHED_ORIGIN,
          locale: 'en',
          serverUrl: PUBLISHED_ORIGIN,
        }),
      );

      expect(
        renderedHelpHrefs(html).every((href) => href.startsWith('https://')),
      ).toBe(true);
      expect(renderedHelpHrefs(html)).toContain(`${PUBLISHED_ORIGIN}/help`);
    });

    it('renders absolute Help URLs in a billing template', async () => {
      const html = await renderEmail(
        BillingTrialEndingEmail({
          userName: 'Tim',
          workspaceDisplayName: 'Acme Inc',
          trialEndsAt: new Date('2026-01-01'),
          dataRetentionDays: 30,
          link: 'https://crm.customer.example/settings/billing',
          locale: 'en',
          serverUrl: PUBLISHED_ORIGIN,
        }),
      );

      expect(renderedHelpHrefs(html)).toEqual([
        `${PUBLISHED_ORIGIN}/help`,
        `${PUBLISHED_ORIGIN}/help`,
      ]);
    });

    it('reduces a configured URL with a path to its origin', async () => {
      const html = await renderEmail(
        PasswordResetLinkEmail({
          duration: '5 minutes',
          hasPassword: false,
          link: 'https://crm.customer.example/reset-password?token=abc',
          locale: 'en',
          serverUrl: 'https://crm.customer.example/app/',
        }),
      );

      expect(renderedHelpHrefs(html)).toEqual([
        `${PUBLISHED_ORIGIN}/help`,
        `${PUBLISHED_ORIGIN}/help`,
      ]);
    });
  });

  describe('without a usable origin', () => {
    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['relative', '/help'],
      ['non-http protocol', 'javascript:alert(1)'],
    ])(
      'omits the Help links instead of rendering a broken one (%s)',
      async (_label, serverUrl) => {
        const html = await renderEmail(
          PasswordResetLinkEmail({
            duration: '5 minutes',
            hasPassword: true,
            link: 'https://crm.customer.example/reset-password?token=abc',
            locale: 'en',
            serverUrl: serverUrl as string | undefined,
          }),
        );

        expect(html).toContain('</html>');
        expect(renderedHelpHrefs(html)).toEqual([]);
        expect(html).not.toMatch(/href="\/help"/);
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('null/help');
        expect(html).not.toMatch(/docs\.twenty\.com/);
        // The CTA and the reset token are untouched by the missing origin.
        expect(html).toContain('/reset-password?token=abc');
      },
    );
  });
});
