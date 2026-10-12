import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Communications settings page must NOT render the discovery/illustration
// hero: it left an empty block above the content. This is a source-level
// witness so a re-introduction fails here instead of shipping a blank area.
const COMMUNICATIONS_SETTINGS_SOURCE = join(
  __dirname,
  '..',
  'SettingsWorkspaceCommunications.tsx',
);

describe('Communications settings page (hero removal)', () => {
  const source = readFileSync(COMMUNICATIONS_SETTINGS_SOURCE, 'utf8');

  it('A: does not render the discovery hero', () => {
    expect(source).not.toContain('SettingsDiscoveryHeroCard');
    expect(source).not.toContain('settings-communications-hero');
  });

  it('A: does not reference the removed cover assets', () => {
    expect(source).not.toContain('cover-dark');
    expect(source).not.toContain('cover-light');
    expect(source).not.toContain('communications/assets');
  });

  it('keeps the Persian page and tab labels', () => {
    // The page title and SMS tab stay localized through the host catalog; the
    // source keeps the English source strings the catalog translates.
    expect(source).toContain('title={t`Communication`}');
    expect(source).toContain('title: t`SMS system`');
  });
});
