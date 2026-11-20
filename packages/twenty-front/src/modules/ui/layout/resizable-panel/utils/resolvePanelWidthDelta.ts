import { type ResizablePanelSide } from '@/ui/layout/resizable-panel/types/ResizablePanelSide';

export type PanelDragDirection = 'ltr' | 'rtl';

// The handle is positioned by flow order, and flow order is mirrored by the
// writing direction, so the same `side` means opposite physical edges in RTL.
// A positive deltaX (pointer moved right) must widen the panel in the RTL
// left-docked layout and narrow it in the mirrored LTR one.
export const resolvePanelWidthDelta = ({
  side,
  dragDirection,
  deltaX,
  uiZoom,
}: {
  side: ResizablePanelSide;
  dragDirection: PanelDragDirection;
  deltaX: number;
  uiZoom: number;
}): number => {
  const scaledDeltaX = deltaX / uiZoom;

  return (side === 'right') !== (dragDirection === 'rtl')
    ? scaledDeltaX
    : -scaledDeltaX;
};
