import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { PageLayoutWidgetErrorDisplay } from '@/page-layout/widgets/components/PageLayoutWidgetErrorDisplay';
import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { useGraphWidgetSalesFunnelData } from '@/page-layout/widgets/graph/graph-widget-sales-funnel/hooks/useGraphWidgetSalesFunnelData';
import {
  getSalesFunnelMarker,
  type SalesFunnelMarker,
} from '@/page-layout/widgets/graph/graph-widget-sales-funnel/utils/salesFunnelMarker';
import { useCurrentWidget } from '@/page-layout/widgets/hooks/useCurrentWidget';
import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';
import { getAppPath } from 'twenty-shared/utils';
import { AppPath } from 'twenty-shared/types';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrapper = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  height: 100%;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTiers = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  min-height: 0;
`;

const StyledTier = styled.div<{ $tone: number; $widthPercent: number }>`
  align-items: center;
  align-self: center;
  background: ${({ $tone }) =>
    `color-mix(in srgb, ${themeCssVariables.color.blue} ${
      100 - $tone * 18
    }%, #ffffff)`};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  clip-path: polygon(3% 0, 97% 0, 92% 100%, 8% 100%);
  color: #ffffff;
  display: flex;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: center;
  min-height: 46px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[4]};
  transition: width 200ms ease;
  width: ${({ $widthPercent }) => Math.max($widthPercent, 34)}%;
`;

const StyledTierLabel = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  opacity: 0.95;
`;

const StyledTierValue = styled.span`
  font-size: ${themeCssVariables.font.size.lg};
  font-variant-numeric: tabular-nums;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledDropoff = styled.div`
  align-items: baseline;
  align-self: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
  justify-content: center;
  white-space: nowrap;
`;

const StyledDropoffValue = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-variant-numeric: tabular-nums;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledRatios = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
`;

const StyledRatio = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 2px;
  min-width: 132px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: center;
`;

const StyledRatioValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-variant-numeric: tabular-nums;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledActions = styled.div`
  align-items: center;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  padding-top: ${themeCssVariables.spacing[2]};
`;

const StyledActionLink = styled(Link)`
  color: ${themeCssVariables.color.blue};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledActionNote = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const formatPercent = (numerator: number, denominator: number): string => {
  if (denominator <= 0) {
    return '— قابل محاسبه نیست';
  }

  const value = (numerator / denominator) * 100;
  const rounded = Math.round(value * 10) / 10;

  return `${rounded.toLocaleString('fa-IR')}٪`;
};

const getTierWidthPercent = (value: number, maximum: number): number => {
  if (maximum <= 0) {
    return 34;
  }

  // Non-linear scale keeps the smallest tier legible; real ratios are shown
  // numerically so the width is never read as an exact proportion.
  return 34 + 66 * Math.sqrt(value / maximum);
};

const UNCONTACTED_VIEW_FALLBACK_ID = '143e2990-1b0e-4562-a7e7-558db58af293';

const SalesFunnelContent = ({
  marker,
  objectMetadataId,
  aggregateFieldMetadataId,
}: {
  marker: SalesFunnelMarker;
  objectMetadataId: string;
  aggregateFieldMetadataId: string;
}) => {
  const { allLeads, contactedLeads, registeredLeads, loading, error } =
    useGraphWidgetSalesFunnelData({
      objectMetadataItemId: objectMetadataId,
      aggregateFieldMetadataId,
      marker,
    });
  const { formatNumber } = useNumberFormat();

  if (loading) {
    return <WidgetSkeletonLoader />;
  }

  if (error) {
    return <PageLayoutWidgetErrorDisplay widgetId={marker.optionFieldMetadataId} error={error} />;
  }

  const uncontacted = Math.max(allLeads - contactedLeads, 0);
  const contactedNotRegistered = Math.max(contactedLeads - registeredLeads, 0);

  const uncontactedViewId =
    marker.uncontactedViewId ?? UNCONTACTED_VIEW_FALLBACK_ID;

  return (
    <StyledWrapper dir="rtl" data-testid="sales-funnel-widget">
      <StyledTiers>
        <StyledTier
          $tone={0}
          $widthPercent={getTierWidthPercent(allLeads, allLeads)}
        >
          <StyledTierLabel>همهٔ سرنخ‌ها</StyledTierLabel>
          <StyledTierValue>{formatNumber(allLeads)}</StyledTierValue>
        </StyledTier>

        <StyledDropoff>
          <span>ریزش:</span>
          <StyledDropoffValue>{formatNumber(uncontacted)}</StyledDropoffValue>
          <span>سرنخ بدون تماس</span>
        </StyledDropoff>

        <StyledTier
          $tone={1}
          $widthPercent={getTierWidthPercent(contactedLeads, allLeads)}
        >
          <StyledTierLabel>تماس‌گرفته</StyledTierLabel>
          <StyledTierValue>{formatNumber(contactedLeads)}</StyledTierValue>
        </StyledTier>

        <StyledDropoff>
          <span>ریزش:</span>
          <StyledDropoffValue>
            {formatNumber(contactedNotRegistered)}
          </StyledDropoffValue>
          <span>تماس‌گرفته بدون ثبت‌نام</span>
        </StyledDropoff>

        <StyledTier
          $tone={2}
          $widthPercent={getTierWidthPercent(registeredLeads, allLeads)}
        >
          <StyledTierLabel>ثبت‌نام تأییدشده</StyledTierLabel>
          <StyledTierValue>{formatNumber(registeredLeads)}</StyledTierValue>
        </StyledTier>
      </StyledTiers>

      <StyledRatios>
        <StyledRatio>
          <StyledRatioValue>
            {formatPercent(contactedLeads, allLeads)}
          </StyledRatioValue>
          <span>پوشش تماس (تماس‌گرفته از همه)</span>
        </StyledRatio>
        <StyledRatio>
          <StyledRatioValue>
            {formatPercent(registeredLeads, contactedLeads)}
          </StyledRatioValue>
          <span>ثبت‌نام از تماس‌گرفته‌ها</span>
        </StyledRatio>
        <StyledRatio>
          <StyledRatioValue>
            {formatPercent(registeredLeads, allLeads)}
          </StyledRatioValue>
          <span>ثبت‌نام از کل سرنخ‌ها</span>
        </StyledRatio>
      </StyledRatios>

      <StyledActions>
        <StyledActionLink
          to={getAppPath(
            AppPath.RecordIndexPage,
            { objectNamePlural: 'eventLeads' },
            { viewId: uncontactedViewId },
          )}
        >
          {formatNumber(uncontacted)} سرنخ بدون تماس — مشاهده فهرست
        </StyledActionLink>
        <StyledActionNote>
          {formatNumber(contactedNotRegistered)} تماس‌گرفته بدون ثبت‌نام —
          پیگیری لازم است (ازدست‌رفته محسوب نمی‌شود)
        </StyledActionNote>
      </StyledActions>
    </StyledWrapper>
  );
};

export const GraphWidgetSalesFunnel = () => {
  const widget = useCurrentWidget();
  const marker = getSalesFunnelMarker(widget.configuration);
  const configuration = widget.configuration as
    | { aggregateFieldMetadataId?: string }
    | null;

  if (!marker || !widget.objectMetadataId || !configuration?.aggregateFieldMetadataId) {
    return null;
  }

  return (
    <SalesFunnelContent
      marker={marker}
      objectMetadataId={widget.objectMetadataId}
      aggregateFieldMetadataId={configuration.aggregateFieldMetadataId}
    />
  );
};
