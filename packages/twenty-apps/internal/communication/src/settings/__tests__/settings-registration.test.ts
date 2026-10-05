import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the W9-R1 decision: the app must NOT register a custom settings front
// component, because Twenty's application settings page shows the Variables
// tab only when no custom settings tab exists
// (`SettingsApplicationDetails.tsx`: `!hasCustomSettingsTab`). A custom tab
// would hide the native variables screen that owns credentials and the default
// provider, and published twenty-sdk@2.35.0 exposes no app-side variable editor.
const APP_ROOT = join(__dirname, '..', '..', '..');
const SOURCE_ROOT = join(APP_ROOT, 'src');

const readApplicationConfig = () =>
  readFileSync(join(SOURCE_ROOT, 'application.config.ts'), 'utf8');

describe('settings registration (W9-R1 decision)', () => {
  it('does not register a custom settings front component', () => {
    expect(readApplicationConfig()).not.toContain('settingsFrontComponent');
  });

  it('does not declare a settings front component anywhere in the app', () => {
    // The retired component was deleted; nothing may reintroduce the API.
    const constants = readFileSync(
      join(SOURCE_ROOT, 'constants', 'universal-identifiers.ts'),
      'utf8',
    );

    expect(constants).not.toContain('COMMUNICATION_SETTINGS_FRONT_COMPONENT');
    expect(constants).toContain('RETIRED');
  });

  it('keeps the native variables as the authoritative configuration surface', () => {
    const view = readFileSync(
      join(SOURCE_ROOT, 'settings', 'communication-settings-view.ts'),
      'utf8',
    );

    // The mapping still names the Variables tab as where configuration is set.
    expect(view).toContain('Variables tab');
  });
});
