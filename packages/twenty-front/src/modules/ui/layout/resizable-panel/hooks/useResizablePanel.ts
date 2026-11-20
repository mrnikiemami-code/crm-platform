import { useCallback, useState } from 'react';

import { getUiZoom } from '@/ui/theme/utils/getUiZoom';
import { useTrackPointer } from '@/ui/utilities/pointer-event/hooks/useTrackPointer';
import { type PointerEventListener } from '@/ui/utilities/pointer-event/types/PointerEventListener';

import { RESIZE_DRAG_THRESHOLD_PX } from '@/ui/layout/resizable-panel/constants/ResizeDragThresholdPx';
import { type ResizablePanelConstraints } from '@/ui/layout/resizable-panel/types/ResizablePanelConstraints';
import { type ResizablePanelSide } from '@/ui/layout/resizable-panel/types/ResizablePanelSide';
import {
  type PanelDragDirection,
  resolvePanelWidthDelta,
} from '@/ui/layout/resizable-panel/utils/resolvePanelWidthDelta';

type UseResizablePanelProps = {
  side: ResizablePanelSide;
  constraints: ResizablePanelConstraints;
  currentWidth: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  cssVariableName?: string;
  onResizeStart?: () => void;
};

const clampWidth = (width: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, width));

// `side` is the edge the handle sits on relative to the panel box, and the box is
// laid out by the writing direction, not the screen. In RTL the same edge is
// physically mirrored, so a rightward pointer move must widen a left-side panel
// instead of narrowing it. The handle's own computed direction is the only source
// of truth that also works when a subtree forces a different direction.
const resolveDragDirection = (element: EventTarget | null): PanelDragDirection => {
  if (!(element instanceof Element)) {
    return 'ltr';
  }

  return window.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
};

export const useResizablePanel = ({
  side,
  constraints,
  currentWidth,
  onWidthChange,
  onCollapse,
  cssVariableName,
  onResizeStart,
}: UseResizablePanelProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [startWidth, setStartWidth] = useState<number>(0);
  const [hasDragged, setHasDragged] = useState(false);

  // captured once per drag: reading computed style on every move would
  // force a synchronous style recalc, and the zoom cannot change mid-drag
  const [dragUiZoom, setDragUiZoom] = useState(1);
  const [dragDirection, setDragDirection] =
    useState<PanelDragDirection>('ltr');

  const getWidthDelta = useCallback(
    (deltaX: number): number =>
      resolvePanelWidthDelta({
        side,
        dragDirection,
        deltaX,
        uiZoom: dragUiZoom,
      }),
    [side, dragDirection, dragUiZoom],
  );

  const handleResizeMove = useCallback<PointerEventListener>(
    ({ x }) => {
      if (startX === null) return;

      const deltaX = (x - startX) / dragUiZoom;

      if (!hasDragged && Math.abs(deltaX) > RESIZE_DRAG_THRESHOLD_PX) {
        setHasDragged(true);
        onResizeStart?.();
      }

      if (Math.abs(deltaX) > RESIZE_DRAG_THRESHOLD_PX) {
        const widthDelta = getWidthDelta(x - startX);
        const clampedWidth = clampWidth(
          startWidth + widthDelta,
          constraints.min,
          constraints.max,
        );

        if (cssVariableName !== undefined) {
          document.documentElement.style.setProperty(
            cssVariableName,
            `${clampedWidth}px`,
          );
        }
      }
    },
    [
      dragUiZoom,
      startX,
      startWidth,
      hasDragged,
      getWidthDelta,
      constraints.min,
      constraints.max,
      cssVariableName,
      onResizeStart,
    ],
  );

  const handleResizeEnd = useCallback<PointerEventListener>(
    ({ x }) => {
      if (startX === null) {
        setIsResizing(false);
        return;
      }

      if (!hasDragged) {
        onCollapse();
      } else {
        const widthDelta = getWidthDelta(x - startX);
        const finalWidth = clampWidth(
          startWidth + widthDelta,
          constraints.min,
          constraints.max,
        );
        onWidthChange(finalWidth);
      }

      setStartX(null);
      setIsResizing(false);
    },
    [
      startX,
      startWidth,
      hasDragged,
      getWidthDelta,
      constraints.min,
      constraints.max,
      onCollapse,
      onWidthChange,
    ],
  );

  useTrackPointer({
    shouldTrackPointer: isResizing,
    onMouseMove: handleResizeMove,
    onMouseUp: handleResizeEnd,
  });

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setDragUiZoom(getUiZoom());
      setDragDirection(resolveDragDirection(event.currentTarget));
      setStartX(event.clientX);
      setStartWidth(currentWidth);
      setHasDragged(false);
      setIsResizing(true);
    },
    [currentWidth],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return {
    isHovered,
    isResizing,
    handleMouseDown,
    handleMouseEnter,
    handleMouseLeave,
  };
};
