import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import { useUpdateMetadataStoreDraft } from '@/metadata-store/hooks/useUpdateMetadataStoreDraft';
import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { type FlatFieldMetadataItem } from '@/metadata-store/types/FlatFieldMetadataItem';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

const createdByField = {
  id: 'created-by',
  name: 'createdBy',
  label: 'ایجادشده توسط',
} as FlatFieldMetadataItem;

const getFieldsEntry = () =>
  jotaiStore.get(metadataStoreState.atomFamily('fieldMetadataItems'));

describe('useUpdateMetadataStoreDraft', () => {
  beforeEach(() => {
    resetJotaiStore();
    jotaiStore.set(metadataStoreState.atomFamily('fieldMetadataItems'), {
      current: [createdByField],
      draft: [],
      status: 'up-to-date',
      currentCollectionHash: 'hash:en:v2',
      draftCollectionHash: 'hash:fa-IR:v2',
    });
  });

  it('records the refetched hash when the refetched fields are unchanged', () => {
    const { result } = renderHook(() => useUpdateMetadataStoreDraft(), {
      wrapper: Wrapper,
    });

    result.current.replaceDraft('fieldMetadataItems', [{ ...createdByField }]);

    expect(getFieldsEntry()).toMatchObject({
      current: [createdByField],
      status: 'up-to-date',
      currentCollectionHash: 'hash:fa-IR:v2',
      draftCollectionHash: undefined,
    });
  });

  it('replaces stale labels with the refetched ones', () => {
    const { result } = renderHook(() => useUpdateMetadataStoreDraft(), {
      wrapper: Wrapper,
    });
    jotaiStore.set(
      metadataStoreState.atomFamily('fieldMetadataItems'),
      (prev) => ({
        ...prev,
        current: [{ ...createdByField, label: 'Created by' }],
      }),
    );

    result.current.replaceDraft('fieldMetadataItems', [createdByField]);
    result.current.applyChanges();

    expect(getFieldsEntry()).toMatchObject({
      current: [createdByField],
      status: 'up-to-date',
      currentCollectionHash: 'hash:fa-IR:v2',
    });
  });
});
