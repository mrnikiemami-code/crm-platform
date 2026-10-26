import { type Layout, type ResponsiveLayouts } from 'react-grid-layout';
import { isDefined } from 'twenty-shared/utils';

import { PAGE_LAYOUT_CONFIG } from '@/page-layout/constants/PageLayoutBreakpoints';

const mirrorLayoutItems = (
  items: Layout[] | undefined,
  columnCount: number,
): Layout[] | undefined => {
  if (!isDefined(items)) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    // RGL positions are physical-left; RTL UIs need inline-start packing.
    x: columnCount - item.x - item.w,
  }));
};

// Stored layouts stay in RGL's physical LTR coordinates. Mirror only when
// feeding the grid for an RTL document (and mirror back on layout change).
export const mirrorResponsiveLayoutsForRtl = (
  layouts: ResponsiveLayouts,
  columns: {
    desktop: number;
    mobile: number;
  } = PAGE_LAYOUT_CONFIG.columns,
): ResponsiveLayouts => ({
  ...layouts,
  desktop: mirrorLayoutItems(layouts.desktop, columns.desktop),
  mobile: mirrorLayoutItems(layouts.mobile, columns.mobile),
});
