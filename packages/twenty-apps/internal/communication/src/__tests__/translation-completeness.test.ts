import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BULK_RESULT_LABELS,
  BULK_STATUS_DELIVERED,
  BULK_STOPPED_UNKNOWN_MESSAGE,
  BULK_STOPPED_UNKNOWN_TITLE,
  BULK_STOPPED_USER_MESSAGE,
  BULK_STOPPED_USER_TITLE,
} from 'src/components/bulk-send-presentation';
import {
  LOADING_TITLE,
  REFRESH_LABEL,
  UNAVAILABLE_REASON_TITLES,
  UNAVAILABLE_TITLE,
} from 'src/timeline/communication-timeline-presentation';

// Proves the fa-IR catalog actually covers every FIXED production string, not
// just that the keys it happens to contain are non-empty. A message added to a
// component without a translation fails here instead of silently falling back
// to English in the Persian UI.
const APP_ROOT = join(__dirname, '..', '..');

const catalog = JSON.parse(
  readFileSync(join(APP_ROOT, 'locales', 'fa-IR.json'), 'utf8'),
) as Record<string, string | Record<string, string>>;

const isTranslated = (message: string): boolean => {
  const value = catalog[message];

  return typeof value === 'string' && value.trim().length > 0;
};

// Literal `t('…')` calls in a component are production copy; extracting them
// from source keeps this list honest as the components change.
const extractLiteralTranslations = (relativePath: string): string[] => {
  const source = readFileSync(join(APP_ROOT, relativePath), 'utf8');

  return [...source.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)].map(
    (match) => match[1].replace(/\\'/g, "'"),
  );
};

describe('fa-IR catalog covers every fixed production message', () => {
  it('translates every literal t() string in the single-person composer', () => {
    const messages = extractLiteralTranslations(
      'src/components/single-person-composer.tsx',
    );

    expect(messages.length).toBeGreaterThan(0);

    for (const message of messages) {
      expect(isTranslated(message), `single composer: "${message}"`).toBe(true);
    }
  });

  it('translates every literal t() string in the bulk composer', () => {
    const messages = extractLiteralTranslations(
      'src/components/bulk-composer.tsx',
    );

    expect(messages.length).toBeGreaterThan(0);

    for (const message of messages) {
      expect(isTranslated(message), `bulk composer: "${message}"`).toBe(true);
    }
  });

  it('translates every literal t() string in the composer entry point', () => {
    const messages = extractLiteralTranslations(
      'src/components/send-message-composer.front-component.tsx',
    );

    for (const message of messages) {
      expect(isTranslated(message), `composer entry: "${message}"`).toBe(true);
    }
  });

  it('translates every literal t() string in the timeline card', () => {
    const messages = extractLiteralTranslations(
      'src/components/communication-timeline-card.front-component.tsx',
    );

    for (const message of messages) {
      expect(isTranslated(message), `timeline card: "${message}"`).toBe(true);
    }
  });

  it('translates the timeline presentation constants and reason titles', () => {
    const fixed = [
      LOADING_TITLE,
      UNAVAILABLE_TITLE,
      REFRESH_LABEL,
      ...Object.values(UNAVAILABLE_REASON_TITLES),
      // Status wording produced by the presentation mapper.
      'Message delivered',
      'Message sent',
      'Message failed',
      'Message queued',
    ];

    for (const message of fixed) {
      expect(isTranslated(message), `presentation: "${message}"`).toBe(true);
    }
  });

  it('translates every bulk send result label and stop notice', () => {
    const fixed = [
      ...Object.values(BULK_RESULT_LABELS),
      BULK_STATUS_DELIVERED,
      BULK_STOPPED_UNKNOWN_TITLE,
      BULK_STOPPED_UNKNOWN_MESSAGE,
      BULK_STOPPED_USER_TITLE,
      BULK_STOPPED_USER_MESSAGE,
    ];

    for (const message of fixed) {
      expect(isTranslated(message), `bulk send: "${message}"`).toBe(true);
    }
  });

  it('translates the submission helper messages shown to the user', () => {
    const shown = [
      'The message may or may not have been sent. Check the communication history before retrying.',
      'The message was sent but its result could not be recorded. Do not retry automatically.',
      'The provider rejected the message and the failure could not be recorded. Do not retry automatically.',
      'The message could not be sent.',
    ];

    for (const message of shown) {
      expect(isTranslated(message), `submit: "${message}"`).toBe(true);
    }
  });

  it('translates the two previously-missing timeline reasons', () => {
    expect(isTranslated('This activity could not be found.')).toBe(true);
    expect(isTranslated('The related record is not a communication.')).toBe(
      true,
    );
  });
});
