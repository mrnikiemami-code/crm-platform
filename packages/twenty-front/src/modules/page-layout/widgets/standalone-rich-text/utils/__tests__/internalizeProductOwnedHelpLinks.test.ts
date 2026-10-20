import { internalizeProductOwnedHelpLinks } from '../internalizeProductOwnedHelpLinks';

// BI-01 review R4: a persisted (pre-BI-01) dashboard widget body carried the
// product's upstream documentation link. Rendering must keep the reader inside
// this installation without rewriting stored customer data.
const legacyDashboardBody = (href: string) => [
  {
    id: 'block-1',
    type: 'paragraph',
    props: { textColor: 'default', backgroundColor: 'default' },
    content: [
      { type: 'text', text: 'If you have any issues, you can check ', styles: {} },
      { type: 'link', href, content: [{ type: 'text', text: 'the guide', styles: {} }] },
    ],
    children: [],
  },
  {
    id: 'block-2',
    type: 'paragraph',
    props: {},
    content: [
      { type: 'link', href: 'https://customer.example/own-docs' },
    ],
    children: [
      {
        id: 'block-2-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'https://docs.twenty.com/getting-started/introduction',
          },
        ],
        children: [],
      },
    ],
  },
];

describe('internalizeProductOwnedHelpLinks', () => {
  it('rewrites the product-owned legacy Help link to the in-app help centre', () => {
    const body = legacyDashboardBody(
      'https://docs.twenty.com/getting-started/introduction',
    );

    const hrefs: (string | undefined)[] = [];

    JSON.stringify(internalizeProductOwnedHelpLinks(body), (key, value) => {
      if (key === 'href') {
        hrefs.push(value as string);
      }
      return value;
    });

    expect(hrefs).toEqual([
      '/help',
      'https://customer.example/own-docs',
      '/help',
    ]);
    expect(JSON.stringify(internalizeProductOwnedHelpLinks(body))).not.toMatch(
      /docs\.twenty\.com/,
    );
  });

  it('does not mutate the stored body', () => {
    const body = legacyDashboardBody(
      'https://docs.twenty.com/getting-started/introduction',
    );
    const snapshot = JSON.stringify(body);

    internalizeProductOwnedHelpLinks(body);

    expect(JSON.stringify(body)).toBe(snapshot);
  });

  it('leaves customer-authored upstream links untouched', () => {
    const customerHref = 'https://docs.twenty.com/getting-started/concepts';

    const rewritten = internalizeProductOwnedHelpLinks(
      legacyDashboardBody(customerHref),
    );

    expect(JSON.stringify(rewritten)).toContain(customerHref);
  });

  it('is a no-op for bodies without links', () => {
    const body = [
      { id: 'b', type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
    ];

    expect(internalizeProductOwnedHelpLinks(body)).toEqual(body);
  });

  it('tolerates non-object input from a malformed stored body', () => {
    expect(internalizeProductOwnedHelpLinks(null)).toBeNull();
    expect(internalizeProductOwnedHelpLinks('')).toBe('');
  });
});
