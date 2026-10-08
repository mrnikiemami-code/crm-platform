import {
  applySecretDraftChange,
  buildSmsProviderPendingWrites,
  dropUnchangedSucceededDrafts,
  EMPTY_SECRET_FIELD_STATE,
  requestSecretClear,
  resolveCommunicationSmsLoadState,
  resolveSecretInputValue,
  resolveSecretIntent,
  resolveSecretWriteValue,
  resolveSmsFieldInputValue,
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

    it('the input shows only the typed replacement, never a stored value', () => {
      expect(resolveSecretInputValue(undefined)).toBe('');
      expect(resolveSecretInputValue(EMPTY_SECRET_FIELD_STATE)).toBe('');
      expect(
        resolveSecretInputValue({
          replacement: 'my-new-key',
          isClearRequested: false,
        }),
      ).toBe('my-new-key');
      // A pending clear shows an empty input, not the stored secret.
      expect(resolveSecretInputValue(requestSecretClear())).toBe('');
    });

    it('carries a full multi-character replacement to the write value', () => {
      const state = applySecretDraftChange({
        previous: EMPTY_SECRET_FIELD_STATE,
        text: 'a-long-secret-key-123',
      });

      expect(resolveSecretInputValue(state)).toBe('a-long-secret-key-123');
      expect(resolveSecretWriteValue(state)).toBe('a-long-secret-key-123');
    });
  });

  describe('form connection: field input and the value sent to the mutation', () => {
    const SECRET_KEY = 'KAVENEGAR_API_KEY';
    const SECRET_FIELD = { key: SECRET_KEY, isSecret: true };
    const NORMAL_FIELD = { key: 'KAVENEGAR_SENDER', isSecret: false };
    const FAKE_SECRET = 'fake-secret-value-xyz-123';

    it('keeps the typed multi-character value in the input when the stored secret is EMPTY', () => {
      // Stored secret is empty, so there is nothing to fall through to.
      const secretFieldStateByKey = {
        [SECRET_KEY]: applySecretDraftChange({
          previous: EMPTY_SECRET_FIELD_STATE,
          text: FAKE_SECRET,
        }),
      };

      const inputValue = resolveSmsFieldInputValue({
        field: SECRET_FIELD,
        draftValueByKey: {},
        storedValueByKey: { [SECRET_KEY]: '' },
        secretFieldStateByKey,
      });

      expect(inputValue).toBe(FAKE_SECRET);
    });

    it('shows ONLY the typed value even when a stored (masked) secret exists', () => {
      // A stored, masked secret must never be what the input displays.
      const maskedStoredValue = 'f********';
      const secretFieldStateByKey = {
        [SECRET_KEY]: applySecretDraftChange({
          previous: EMPTY_SECRET_FIELD_STATE,
          text: FAKE_SECRET,
        }),
      };

      const inputValue = resolveSmsFieldInputValue({
        field: SECRET_FIELD,
        draftValueByKey: {},
        storedValueByKey: { [SECRET_KEY]: maskedStoredValue },
        secretFieldStateByKey,
      });

      expect(inputValue).toBe(FAKE_SECRET);
      expect(inputValue).not.toBe(maskedStoredValue);
    });

    it('sends the full typed value to the mutation for an empty stored secret', () => {
      const secretFieldStateByKey = {
        [SECRET_KEY]: applySecretDraftChange({
          previous: EMPTY_SECRET_FIELD_STATE,
          text: FAKE_SECRET,
        }),
      };

      const pendingWrites = buildSmsProviderPendingWrites({
        fields: [SECRET_FIELD],
        draftValueByKey: {},
        storedValueByKey: { [SECRET_KEY]: '' },
        secretFieldStateByKey,
      });

      expect(pendingWrites).toEqual([{ key: SECRET_KEY, value: FAKE_SECRET }]);
    });

    it('never sends the masked value, and sends nothing for an untouched secret', () => {
      const maskedStoredValue = 'f********';

      // Untouched: KEEP writes nothing, so the stored secret stays intact.
      expect(
        buildSmsProviderPendingWrites({
          fields: [SECRET_FIELD],
          draftValueByKey: {},
          storedValueByKey: { [SECRET_KEY]: maskedStoredValue },
          secretFieldStateByKey: {},
        }),
      ).toEqual([]);
    });

    it('still reads a normal field from its draft, not the secret state', () => {
      expect(
        resolveSmsFieldInputValue({
          field: NORMAL_FIELD,
          draftValueByKey: { KAVENEGAR_SENDER: 'fake-sender' },
          storedValueByKey: {},
          secretFieldStateByKey: {},
        }),
      ).toBe('fake-sender');
    });

    it('writes a normal field only when its draft differs from what is stored', () => {
      expect(
        buildSmsProviderPendingWrites({
          fields: [NORMAL_FIELD],
          draftValueByKey: { KAVENEGAR_SENDER: 'fake-sender' },
          storedValueByKey: { KAVENEGAR_SENDER: 'fake-sender' },
          secretFieldStateByKey: {},
        }),
      ).toEqual([]);

      expect(
        buildSmsProviderPendingWrites({
          fields: [NORMAL_FIELD],
          draftValueByKey: { KAVENEGAR_SENDER: 'fake-sender-new' },
          storedValueByKey: { KAVENEGAR_SENDER: 'fake-sender' },
          secretFieldStateByKey: {},
        }),
      ).toEqual([{ key: 'KAVENEGAR_SENDER', value: 'fake-sender-new' }]);
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

  describe('dropUnchangedSucceededDrafts', () => {
    it('drops a key whose draft is unchanged since the save started', () => {
      const draftsAtSaveStart = { KAVENEGAR_SENDER: 'saved-value' };
      const latestDrafts = { KAVENEGAR_SENDER: 'saved-value' };

      expect(
        dropUnchangedSucceededDrafts({
          latestDrafts,
          draftsAtSaveStart,
          succeededKeys: ['KAVENEGAR_SENDER'],
        }),
      ).toEqual({});
    });

    it('keeps an edit made during the save on the SAME key (deferred)', () => {
      // A deferred save: the key succeeded, but the user edited it again while
      // the write was in flight, so the newer draft must survive.
      const draftsAtSaveStart = { KAVENEGAR_SENDER: 'submitted-value' };
      const latestDrafts = { KAVENEGAR_SENDER: 'edited-during-save' };

      expect(
        dropUnchangedSucceededDrafts({
          latestDrafts,
          draftsAtSaveStart,
          succeededKeys: ['KAVENEGAR_SENDER'],
        }),
      ).toEqual({ KAVENEGAR_SENDER: 'edited-during-save' });
    });

    it('keeps a secret draft edited during the save on the same key (deferred)', () => {
      const submitted = {
        replacement: 'submitted-secret',
        isClearRequested: false,
      };
      const editedDuringSave = {
        replacement: 'newer-secret',
        isClearRequested: false,
      };

      const result = dropUnchangedSucceededDrafts({
        latestDrafts: { KAVENEGAR_API_KEY: editedDuringSave },
        draftsAtSaveStart: { KAVENEGAR_API_KEY: submitted },
        succeededKeys: ['KAVENEGAR_API_KEY'],
      });

      expect(result).toEqual({ KAVENEGAR_API_KEY: editedDuringSave });
    });

    it('keeps the draft of a field whose write failed', () => {
      const drafts = { KAVENEGAR_SENDER: 'retry-me' };

      // The failed key is not in succeededKeys, so its draft survives.
      expect(
        dropUnchangedSucceededDrafts({
          latestDrafts: drafts,
          draftsAtSaveStart: drafts,
          succeededKeys: [],
        }),
      ).toEqual({ KAVENEGAR_SENDER: 'retry-me' });
    });
  });
});
