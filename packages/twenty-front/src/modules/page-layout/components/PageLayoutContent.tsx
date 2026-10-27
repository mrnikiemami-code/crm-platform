import { DashboardSharedFilterStrip } from '@/page-layout/components/DashboardSharedFilterStrip';
import { PageLayoutGridLayout } from '@/page-layout/components/PageLayoutGridLayout';
import { PageLayoutVerticalList } from '@/page-layout/components/PageLayoutVerticalList';
import { usePageLayoutContentContext } from '@/page-layout/contexts/PageLayoutContentContext';
import { useCurrentPageLayoutOrThrow } from '@/page-layout/hooks/useCurrentPageLayoutOrThrow';
import { useIsPageLayoutInEditMode } from '@/page-layout/hooks/useIsPageLayoutInEditMode';
import { usePageLayoutTabWithVisibleWidgetsOrThrow } from '@/page-layout/hooks/usePageLayoutTabWithVisibleWidgetsOrThrow';
import { RecordPageAddWidgetSection } from '@/page-layout/widgets/components/RecordPageAddWidgetSection';
import { RecordPageWidgetInsertionSeparator } from '@/page-layout/widgets/components/RecordPageWidgetInsertionSeparator';
import { StandaloneWidgetPlaceholder } from '@/page-layout/widgets/components/StandaloneWidgetPlaceholder';
import { isViewportFillingWidget } from '@/page-layout/widgets/utils/isViewportFillingWidget';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import {
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from '~/generated-metadata/graphql';

const StyledDashboardContent = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
`;

const StyledEmptyStandalonePageContainer = styled.div`
  display: grid;
  height: 100%;
`;

export const PageLayoutContent = () => {
  const isPageLayoutInEditMode = useIsPageLayoutInEditMode();

  const { layoutMode, tabId } = usePageLayoutContentContext();

  const activeTab = usePageLayoutTabWithVisibleWidgetsOrThrow(tabId);
  const firstWidget = activeTab.widgets[0];

  const { currentPageLayout } = useCurrentPageLayoutOrThrow();

  const isRecordPageLayout =
    currentPageLayout.type === PageLayoutType.RECORD_PAGE;

  const isGridLayout = layoutMode === PageLayoutTabLayoutMode.GRID;

  const isEmptyStandalonePage =
    currentPageLayout.type === PageLayoutType.STANDALONE_PAGE &&
    activeTab.widgets.length === 0;

  if (isEmptyStandalonePage) {
    return (
      <StyledEmptyStandalonePageContainer>
        <StandaloneWidgetPlaceholder />
      </StyledEmptyStandalonePageContainer>
    );
  }

  const isDashboardLayout =
    currentPageLayout.type === PageLayoutType.DASHBOARD;

  if (isGridLayout) {
    if (isDashboardLayout) {
      return (
        <StyledDashboardContent>
          <DashboardSharedFilterStrip />
          <PageLayoutGridLayout tabId={tabId} />
        </StyledDashboardContent>
      );
    }

    return <PageLayoutGridLayout tabId={tabId} />;
  }

  const verticalList = (
    <PageLayoutVerticalList
      isInEditMode={isPageLayoutInEditMode && isRecordPageLayout}
      widgets={activeTab.widgets}
      leadingElement={
        isRecordPageLayout &&
        isDefined(firstWidget) &&
        isViewportFillingWidget(firstWidget) ? (
          <RecordPageAddWidgetSection
            insertionContext={{
              targetWidgetId: firstWidget.id,
              direction: 'above',
            }}
          />
        ) : undefined
      }
      trailingElement={
        isRecordPageLayout ? <RecordPageAddWidgetSection /> : undefined
      }
      renderWidgetSeparator={
        isRecordPageLayout
          ? (widget) => <RecordPageWidgetInsertionSeparator widget={widget} />
          : undefined
      }
    />
  );

  if (isDashboardLayout) {
    return (
      <StyledDashboardContent>
        <DashboardSharedFilterStrip />
        {verticalList}
      </StyledDashboardContent>
    );
  }

  return verticalList;
};
