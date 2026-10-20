import { getCustomApplicationDescription } from '../getCustomApplicationDescription';
import { getStandardApplicationDescription } from '../getStandardApplicationDescription';

// BI-01 review R1: the About tab renders these Markdown descriptions for the
// standard and custom applications. Product-owned Help links must stay inside
// this installation; nothing may send the reader to twenty.com/docs.twenty.com.
const DESCRIPTIONS = [
  {
    name: 'standard application',
    getDescription: getStandardApplicationDescription,
  },
  {
    name: 'custom application',
    getDescription: getCustomApplicationDescription,
  },
];

const markdownLinkTargets = (markdown: string): string[] =>
  Array.from(markdown.matchAll(/\]\(([^)\s]+)\)/g), (match) => match[1]);

describe('product-owned application descriptions', () => {
  it.each(DESCRIPTIONS)(
    'does not link the $name description to an external Help site',
    ({ getDescription }) => {
      const description = getDescription();

      expect(description.length).toBeGreaterThan(0);
      expect(description).not.toMatch(/https?:\/\//);
      expect(description).not.toMatch(/twenty\.com/);
      expect(description).not.toMatch(/docs\.twenty\.com/);
      expect(description).not.toMatch(/developers\/extend\/apps/);
    },
  );

  it.each(DESCRIPTIONS)(
    'keeps every Markdown link in the $name description same-origin',
    ({ getDescription }) => {
      const description = getDescription();

      for (const target of markdownLinkTargets(description)) {
        expect(target.startsWith('/')).toBe(true);
        expect(target.startsWith('//')).toBe(false);
      }
    },
  );

  it.each(DESCRIPTIONS)(
    'points the $name description at the in-app help centre instead',
    ({ getDescription }) => {
      expect(getDescription()).toMatch(/in-app Help/);
    },
  );
});
