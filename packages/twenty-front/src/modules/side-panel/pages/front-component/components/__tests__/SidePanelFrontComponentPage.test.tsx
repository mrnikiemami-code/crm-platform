import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { type Store } from 'jotai/vanilla/store';

import { SidePanelFrontComponentPage } from '@/side-panel/pages/front-component/components/SidePanelFrontComponentPage';
import { viewableFrontComponentIdComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentIdComponentState';
import { viewableFrontComponentRecordContextComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentRecordContextComponentState';
import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

// The renderer is the real boundary under test: the page must hand it the FULL
// selectedRecordIds array. It is stubbed only at the module boundary so the
// test can read exactly what the production page passes, without the sandbox.
const rendererCalls: { selectedRecordIds?: string[] }[] = [];

jest.mock('@/front-components/components/FrontComponentRenderer', () => ({
  FrontComponentRenderer: ({
    selectedRecordIds,
  }: {
    selectedRecordIds?: string[];
  }) => {
    rendererCalls.push({ selectedRecordIds });

    return (
      <div data-testid="renderer">
        {JSON.stringify(selectedRecordIds ?? null)}
      </div>
    );
  },
}));

const FRONT_COMPONENT_ID = 'fc-test-id';
const PAGE_INSTANCE_ID = 'side-panel-page-instance-id';

const renderSidePanelPage = (
  context: {
    selectedRecordIds: string[];
    objectNameSingular: string;
  } | null,
) => {
  let store: Store;

  const BaseWrapper = getJestMetadataAndApolloMocksWrapper({
    apolloMocks: [],
    onInitializeJotaiStore: (initializedStore) => {
      store = initializedStore;

      initializedStore.set(
        viewableFrontComponentIdComponentState.atomFamily({
          instanceId: PAGE_INSTANCE_ID,
        }),
        FRONT_COMPONENT_ID,
      );

      initializedStore.set(
        viewableFrontComponentRecordContextComponentState.atomFamily({
          instanceId: PAGE_INSTANCE_ID,
        }),
        context,
      );
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <BaseWrapper>
      <SidePanelPageComponentInstanceContext.Provider
        value={{ instanceId: PAGE_INSTANCE_ID }}
      >
        {children}
      </SidePanelPageComponentInstanceContext.Provider>
    </BaseWrapper>
  );

  const result = render(<SidePanelFrontComponentPage />, { wrapper });

  return { result, getStore: () => store };
};

// The page renders the renderer through `React.lazy`, so the stub appears after
// a microtask; every assertion awaits it rather than reading a stale DOM.
const getRenderer = () => screen.findByTestId('renderer');

const lastForwardedIds = () =>
  rendererCalls[rendererCalls.length - 1]?.selectedRecordIds;

describe('SidePanelFrontComponentPage forwards the record selection to the renderer', () => {
  beforeEach(() => {
    rendererCalls.length = 0;
  });

  it('passes a SINGLE selected id as a one-element array', async () => {
    renderSidePanelPage({
      selectedRecordIds: ['record-1'],
      objectNameSingular: 'person',
    });

    expect(await getRenderer()).toHaveTextContent(JSON.stringify(['record-1']));
    expect(lastForwardedIds()).toEqual(['record-1']);
  });

  it('passes BOTH ids when two records are selected', async () => {
    renderSidePanelPage({
      selectedRecordIds: ['record-1', 'record-2'],
      objectNameSingular: 'person',
    });

    expect(await getRenderer()).toHaveTextContent(
      JSON.stringify(['record-1', 'record-2']),
    );
    expect(lastForwardedIds()).toEqual(['record-1', 'record-2']);
  });

  it('passes an EMPTY array for an empty selection (not undefined)', async () => {
    renderSidePanelPage({
      selectedRecordIds: [],
      objectNameSingular: 'person',
    });

    expect(await getRenderer()).toHaveTextContent('[]');
    expect(lastForwardedIds()).toEqual([]);
  });

  it('passes no ids when there is no record context at all', async () => {
    renderSidePanelPage(null);

    expect(await getRenderer()).toHaveTextContent('null');
    expect(lastForwardedIds()).toBeUndefined();
  });

  it('re-renders with the NEW ids when the selection changes', async () => {
    const { getStore } = renderSidePanelPage({
      selectedRecordIds: ['record-1'],
      objectNameSingular: 'person',
    });

    expect(await getRenderer()).toHaveTextContent(JSON.stringify(['record-1']));

    // A different selection replaces the previous one — no stale id survives.
    // The page subscribes to the component state, so setting it re-renders.
    act(() => {
      getStore().set(
        viewableFrontComponentRecordContextComponentState.atomFamily({
          instanceId: PAGE_INSTANCE_ID,
        }),
        {
          selectedRecordIds: ['record-8', 'record-9'],
          objectNameSingular: 'person',
        },
      );
    });

    expect(lastForwardedIds()).toEqual(['record-8', 'record-9']);
  });

  it('does not carry a previous selection when the panel reopens empty', async () => {
    const { getStore } = renderSidePanelPage({
      selectedRecordIds: ['record-1', 'record-2'],
      objectNameSingular: 'person',
    });

    expect(await getRenderer()).toHaveTextContent(
      JSON.stringify(['record-1', 'record-2']),
    );

    // Closing and reopening the panel with no selection: the state is null.
    act(() => {
      getStore().set(
        viewableFrontComponentRecordContextComponentState.atomFamily({
          instanceId: PAGE_INSTANCE_ID,
        }),
        null,
      );
    });

    expect(lastForwardedIds()).toBeUndefined();
  });
});
