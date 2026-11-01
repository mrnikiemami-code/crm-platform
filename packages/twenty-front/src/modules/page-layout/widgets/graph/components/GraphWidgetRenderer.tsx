import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { PageLayoutWidgetNoDataDisplay } from '@/page-layout/widgets/components/PageLayoutWidgetNoDataDisplay';
import { GraphWidget } from '@/page-layout/widgets/graph/components/GraphWidget';
import { GraphWidgetSalesFunnel } from '@/page-layout/widgets/graph/graph-widget-sales-funnel/components/GraphWidgetSalesFunnel';
import { getSalesFunnelMarker } from '@/page-layout/widgets/graph/graph-widget-sales-funnel/utils/salesFunnelMarker';
import { hasMinimalRequiredConfigForGraph } from '@/page-layout/widgets/graph/utils/hasMinimalRequiredConfigForGraph';
import { isDefined } from 'twenty-shared/utils';

type GraphWidgetRendererProps = {
  widget: PageLayoutWidget;
};

export const GraphWidgetRenderer = ({ widget }: GraphWidgetRendererProps) => {
  if (
    !isDefined(widget.configuration) ||
    !isDefined(widget.objectMetadataId) ||
    !hasMinimalRequiredConfigForGraph(widget.configuration)
  ) {
    return <PageLayoutWidgetNoDataDisplay />;
  }

  // Funnel view mode: the chart's JSON filter carries a marker the server
  // ignores, so no new widget type, DTO or enum change is needed.
  if (isDefined(getSalesFunnelMarker(widget.configuration))) {
    return <GraphWidgetSalesFunnel />;
  }

  return <GraphWidget />;
};
