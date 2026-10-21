import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';

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

const HELP_CENTER_ARTICLE_PREFIX = `${HELP_CENTER_BASE_PATH}/`;

const markdownLinkTargets = (markdown: string): string[] =>
  Array.from(markdown.matchAll(/\]\(([^)\s]+)\)/g), (match) => match[1]);

// A link target is in-app when it is an absolute path and carries no scheme or
// protocol-relative host. Both `//twenty.com/help` and `https://twenty.com/help`
// are therefore rejected.
const isInAppLinkTarget = (target: string): boolean =>
  target.startsWith('/') && !target.startsWith('//');

const isHelpCenterLinkTarget = (target: string): boolean =>
  target === HELP_CENTER_BASE_PATH ||
  target.startsWith(HELP_CENTER_ARTICLE_PREFIX);

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

  // These descriptions are translated at runtime through Lingui, so asserting
  // English prose couples the test to whichever catalog the harness happens to
  // load (a missing catalog entry makes the macro return the message id). The
  // contract we actually own is structural: real prose, no external Help site,
  // and no dead Markdown link constructs.
  it.each(DESCRIPTIONS)(
    'keeps the $name description self-contained and free of dead translation ids',
    ({ getDescription }) => {
      const description = getDescription();

      expect(description.trim().length).toBeGreaterThan(0);
      expect(description.trim().split(/\s+/).length).toBeGreaterThan(10);
      expect(description).not.toMatch(/https?:\/\//);
      expect(description).not.toMatch(/\]\(\s*\)/);
    },
  );

  // Neither description ships a Markdown link today, so this contract is
  // asserted over the targets that exist rather than requiring one: adding a
  // link is allowed only when it points back into this app, and Help
  // navigation must use the shared route instead of a hardcoded literal.
  it.each(DESCRIPTIONS)(
    'keeps every Markdown link in the $name description inside the app shell',
    ({ getDescription }) => {
      const targets = markdownLinkTargets(getDescription());

      expect(targets.filter((target) => !isInAppLinkTarget(target))).toEqual([]);
      // Anything squatting on the Help prefix has to be a real Help route
      // (`/help` or `/help/<slug>`), never a lookalike such as `/helpdesk`.
      expect(
        targets.filter(
          (target) =>
            target.startsWith(HELP_CENTER_BASE_PATH) &&
            !isHelpCenterLinkTarget(target),
        ),
      ).toEqual([]);
    },
  );
});
