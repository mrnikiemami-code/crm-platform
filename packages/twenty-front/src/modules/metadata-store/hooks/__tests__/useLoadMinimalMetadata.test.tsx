import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { useLoadMinimalMetadata } from '@/metadata-store/hooks/useLoadMinimalMetadata';
import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { computeLocalizedCollectionHash } from '@/metadata-store/utils/computeLocalizedCollectionHash';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

const SERVER_FIELDS_HASH = 'fields-hash';

const mockQuery = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useApolloClient: () => ({ query: mockQuery }),
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

const setViewerLocale = (locale: string) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);
};

const setStoredFieldsHash = (currentCollectionHash: string | undefined) => {
  jotaiStore.set(
    metadataStoreState.atomFamily('fieldMetadataItems'),
    (prev) => ({
      ...prev,
      currentCollectionHash,
    }),
  );
};

const loadStaleEntityKeys = async () => {
  const { result } = renderHook(() => useLoadMinimalMetadata(), {
    wrapper: Wrapper,
  });

  const loaded = await result.current.loadMinimalMetadata();

  return loaded?.staleEntityKeys ?? [];
};

describe('useLoadMinimalMetadata', () => {
  beforeEach(() => {
    resetJotaiStore();
    mockQuery.mockResolvedValue({
      data: {
        minimalMetadata: {
          objectMetadataItems: [],
          views: [],
          collectionHashes: [
            { collectionName: 'fieldMetadata', hash: SERVER_FIELDS_HASH },
          ],
        },
      },
    });
  });

  it('keeps fields cached for the locale they were localized in', async () => {
    setViewerLocale('fa-IR');
    setStoredFieldsHash(
      computeLocalizedCollectionHash({
        collectionHash: SERVER_FIELDS_HASH,
        locale: 'fa-IR',
      }),
    );

    expect(await loadStaleEntityKeys()).not.toContain('fieldMetadataItems');
  });

  it('refetches fields localized in English when the viewer uses fa-IR', async () => {
    setViewerLocale('fa-IR');
    setStoredFieldsHash(
      computeLocalizedCollectionHash({
        collectionHash: SERVER_FIELDS_HASH,
        locale: 'en',
      }),
    );

    expect(await loadStaleEntityKeys()).toContain('fieldMetadataItems');
  });

  it('refetches fields localized in Persian when the viewer uses en', async () => {
    setViewerLocale('en');
    setStoredFieldsHash(
      computeLocalizedCollectionHash({
        collectionHash: SERVER_FIELDS_HASH,
        locale: 'fa-IR',
      }),
    );

    expect(await loadStaleEntityKeys()).toContain('fieldMetadataItems');
  });

  it('refetches fields cached before labels were localized by locale', async () => {
    setViewerLocale('fa-IR');
    setStoredFieldsHash(SERVER_FIELDS_HASH);

    expect(await loadStaleEntityKeys()).toContain('fieldMetadataItems');
  });

  it('stores the hash scoped to the viewer locale', async () => {
    setViewerLocale('fa-IR');

    await loadStaleEntityKeys();

    expect(
      jotaiStore.get(metadataStoreState.atomFamily('fieldMetadataItems'))
        .draftCollectionHash,
    ).toBe(
      computeLocalizedCollectionHash({
        collectionHash: SERVER_FIELDS_HASH,
        locale: 'fa-IR',
      }),
    );
  });
});
