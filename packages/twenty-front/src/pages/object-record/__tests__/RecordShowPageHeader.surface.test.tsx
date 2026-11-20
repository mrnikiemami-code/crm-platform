import { render, screen } from '@testing-library/react';

import { RecordShowPageHeader } from '~/pages/object-record/RecordShowPageHeader';

const mockSurface = { type: 'side-panel' as 'main' | 'side-panel' };
const mockRecord = { id: 'record-1', name: 'پیش‌فاکتور هفتگی' } as
  | { id: string; name: string }
  | undefined;

jest.mock('@/ui/layout/hooks/useWorkspaceSurface', () => ({
  useWorkspaceSurface: () => ({ type: mockSurface.type }),
}));

jest.mock('@/object-metadata/hooks/useLabelIdentifierFieldMetadataItem', () => ({
  useLabelIdentifierFieldMetadataItem: () => ({
    labelIdentifierFieldMetadataItem: { name: 'name', type: 'TEXT' },
  }),
}));

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({
    objectMetadataItem: { labelSingular: 'پیش‌فاکتور' },
  }),
}));

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue', () => ({
  useAtomFamilyStateValue: () => mockRecord,
}));

jest.mock('@/object-record/record-show/hooks/useRecordShowPagePagination', () => ({
  useRecordShowPagePagination: () => ({
    objectMetadataItem: { labelPlural: 'پیش‌فاکتورها', fields: [] },
  }),
}));

jest.mock('@/object-record/record-show/components/RecordIdentifierBarTitle', () => ({
  RecordIdentifierBarTitle: () => <div data-testid="record-title" />,
}));

jest.mock(
  '@/object-record/record-show/components/ObjectRecordShowPageBreadcrumb',
  () => ({
    ObjectRecordShowPageBreadcrumb: () => <div data-testid="breadcrumb" />,
  }),
);

jest.mock('@/side-panel/components/SidePanelPageTitleSyncEffect', () => ({
  SidePanelPageTitleSyncEffect: ({ pageTitle }: { pageTitle?: string }) => (
    <div data-testid="panel-title-sync">{pageTitle}</div>
  ),
}));

jest.mock('@/ui/layout/page/components/PageCardHeader', () => ({
  PageCardHeader: ({
    title,
    breadcrumb,
  }: {
    title?: React.ReactNode;
    breadcrumb?: React.ReactNode;
  }) => (
    <div data-testid="card-header">
      {title}
      {breadcrumb}
    </div>
  ),
}));

describe('RecordShowPageHeader side panel title', () => {
  it('names the panel page after the record instead of the routed path', () => {
    mockSurface.type = 'side-panel';

    render(
      <RecordShowPageHeader
        objectNameSingular="quotation"
        objectRecordId="record-1"
      />,
    );

    expect(screen.getByTestId('panel-title-sync')).toHaveTextContent(
      'پیش‌فاکتور هفتگی',
    );
    expect(screen.getByTestId('record-title')).toBeInTheDocument();
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('leaves the main surface breadcrumb untouched', () => {
    mockSurface.type = 'main';

    render(
      <RecordShowPageHeader
        objectNameSingular="quotation"
        objectRecordId="record-1"
      />,
    );

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-title-sync')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-title')).not.toBeInTheDocument();
  });
});
