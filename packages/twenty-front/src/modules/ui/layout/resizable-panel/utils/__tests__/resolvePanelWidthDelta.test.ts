import { resolvePanelWidthDelta } from '@/ui/layout/resizable-panel/utils/resolvePanelWidthDelta';

describe('resolvePanelWidthDelta', () => {
  it('widens a left-side handle when the pointer moves left in LTR', () => {
    expect(
      resolvePanelWidthDelta({
        side: 'left',
        dragDirection: 'ltr',
        deltaX: -40,
        uiZoom: 1,
      }),
    ).toBe(40);
  });

  it('widens a left-side handle when the pointer moves right in RTL', () => {
    // The regression: an RTL layout puts the same handle on the opposite
    // physical edge, so pretending it is LTR narrowed the panel on every drag.
    expect(
      resolvePanelWidthDelta({
        side: 'left',
        dragDirection: 'rtl',
        deltaX: 40,
        uiZoom: 1,
      }),
    ).toBe(40);
  });

  it('narrows a left-side handle when the pointer moves left in RTL', () => {
    expect(
      resolvePanelWidthDelta({
        side: 'left',
        dragDirection: 'rtl',
        deltaX: -40,
        uiZoom: 1,
      }),
    ).toBe(-40);
  });

  it('widens a right-side handle when the pointer moves right in LTR', () => {
    expect(
      resolvePanelWidthDelta({
        side: 'right',
        dragDirection: 'ltr',
        deltaX: 40,
        uiZoom: 1,
      }),
    ).toBe(40);
  });

  it('divides the pointer movement by the browser zoom', () => {
    expect(
      resolvePanelWidthDelta({
        side: 'left',
        dragDirection: 'rtl',
        deltaX: 80,
        uiZoom: 2,
      }),
    ).toBe(40);
  });
});
