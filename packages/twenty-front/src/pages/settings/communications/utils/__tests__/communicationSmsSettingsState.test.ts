import {
  applySecretDraftChange,
  dropSucceededDrafts,
  EMPTY_SECRET_FIELD_STATE,
  requestSecretClear,
  resolveCommunicationSmsLoadState,
  resolveSecretIntent,
  resolveSecretWriteValue,
  summarizeSaveOutcome,
} from '~/pages/settings/communications/utils/communicationSmsSettingsState';

describe('communicationSmsSettingsState', () => {
  describe('resolveCommunicationSmsLoadState', () => {
    it('reports LOADING while the query is in flight', () => {
      expect(
        resolveCommunicationSmsLoadState({
          loading: true,
          hasError: false,
          hasApplication: false,
        }),
      ).toEqual({ kind: 'LOADING' });
    });

    it('reports ERROR for a failed request, never NOT_INSTALLED', () => {
      // A network or permission failure must not be shown as "not installed":
      // that would tell the user to install an app that is already there.
      expect(
        resolveCommunicationSmsLoadState({
          loading: false,
          hasError: true,
          hasApplication: false,
        }),
      ).toEqual({ kind: 'ERROR' });
    });

    it('reports NOT_INSTALLED only when the request succeeded and returned null', () => {
      expect(
        resolveCommunicationSmsLoadState({
          loading: false,
          hasError: false,
          hasApplication: false,
        }),
      ).toEqual({ kind: 'NOT_INSTALLED' });
    });

    it('reports READY when the application is present', () => {
      expect(
        resolveCommunicationSmsLoadState({
          loading: false,
          hasError: false,
          hasApplication: true,
        }),
      ).toEqual({ kind: 'READY' });
    });
  });

  describe('secret intent', () => {
    it('defaults to KEEP for an empty input', () => {
      expect(resolveSecretIntent(undefined)).toBe('KEEP');
      expect(resolveSecretIntent(EMPTY_SECRET_FIELD_STATE)).toBe('KEEP');
    });

    it('is REPLACE once a new value is typed', () => {
      expect(
        resolveSecretIntent({
          replacement: 'new-value',
          isClearRequested: false,
        }),
      ).toBe('REPLACE');
    });

    it('is CLEAR only after the explicit action', () => {
      expect(resolveSecretIntent(requestSecretClear())).toBe('CLEAR');
    });

    it('typing a new value after Clear cancels the clear intent', () => {
      const afterClear = requestSecretClear();
      const afterTyping = applySecretDraftChange({
        previous: afterClear,
        text: 'new-value',
      });

      expect(afterTyping.isClearRequested).toBe(false);
      expect(resolveSecretIntent(afterTyping)).toBe('REPLACE');
    });

    it('an empty input alone never clears an existing secret', () => {
      const afterEmptyTyping = applySecretDraftChange({
        previous: EMPTY_SECRET_FIELD_STATE,
        text: '',
      });

      expect(resolveSecretIntent(afterEmptyTyping)).toBe('KEEP');
    });

    it('keeps a pending clear when the input stays empty', () => {
      const afterClear = requestSecretClear();
      const stillEmpty = applySecretDraftChange({
        previous: afterClear,
        text: '',
      });

      expect(resolveSecretIntent(stillEmpty)).toBe('CLEAR');
    });

    it('KEEP writes nothing at all', () => {
      expect(resolveSecretWriteValue(undefined)).toBeUndefined();
      expect(resolveSecretWriteValue(EMPTY_SECRET_FIELD_STATE)).toBeUndefined();
    });

    it('REPLACE writes the typed value and CLEAR writes an empty string', () => {
      expect(
        resolveSecretWriteValue({
          replacement: 'new-value',
          isClearRequested: false,
        }),
      ).toBe('new-value');
      expect(resolveSecretWriteValue(requestSecretClear())).toBe('');
    });
  });

  describe('summarizeSaveOutcome', () => {
    it('reports ALL_SAVED when nothing needed writing', () => {
      expect(summarizeSaveOutcome({ succeededCount: 0, totalCount: 0 })).toBe(
        'ALL_SAVED',
      );
    });

    it('reports PARTIAL for a partial failure', () => {
      expect(summarizeSaveOutcome({ succeededCount: 1, totalCount: 3 })).toBe(
        'PARTIAL',
      );
    });

    it('reports NONE_SAVED only when every write failed', () => {
      expect(summarizeSaveOutcome({ succeededCount: 0, totalCount: 2 })).toBe(
        'NONE_SAVED',
      );
    });

    it('reports ALL_SAVED when every write succeeded', () => {
      expect(summarizeSaveOutcome({ succeededCount: 2, totalCount: 2 })).toBe(
        'ALL_SAVED',
      );
    });
  });

  describe('dropSucceededDrafts', () => {
    it('keeps an edit made while the save was in flight', () => {
      // The draft map passed in is the LATEST one, so a field edited during the
      // save keeps its newer value even though its write succeeded.
      const latestDrafts = {
        KAVENEGAR_SENDER: 'edited-during-save',
        KAVENEGAR_ENDPOINT: 'saved-value',
      };

      const result = dropSucceededDrafts(latestDrafts, ['KAVENEGAR_ENDPOINT']);

      expect(result).toEqual({ KAVENEGAR_SENDER: 'edited-during-save' });
    });

    it('keeps the draft of a field whose write failed', () => {
      const latestDrafts = { KAVENEGAR_SENDER: 'retry-me' };

      // The failed key is not in succeededKeys, so its draft survives.
      expect(dropSucceededDrafts(latestDrafts, [])).toEqual({
        KAVENEGAR_SENDER: 'retry-me',
      });
    });
  });
});
