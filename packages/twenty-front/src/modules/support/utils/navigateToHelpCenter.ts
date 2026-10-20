import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';

/**
 * Navigates the whole document to the in-app help centre.
 *
 * A full document navigation (instead of an in-app router push) is deliberate:
 * the help URL must survive a refresh and a direct visit, and a document load
 * exercises exactly that path. It is same-origin and never a new tab, so the
 * reader stays inside this installation.
 *
 * Extracted so the menu wiring can be tested without touching jsdom's read-only
 * `window.location`.
 */
export const navigateToHelpCenter = (): void => {
  window.location.assign(HELP_CENTER_BASE_PATH);
};
