import { mirrorResponsiveLayoutsForRtl } from '@/page-layout/utils/mirrorResponsiveLayoutsForRtl';
import { type ResponsiveLayouts } from 'react-grid-layout';

describe('mirrorResponsiveLayoutsForRtl', () => {
  it('mirrors desktop x against the column count and leaves size intact', () => {
    const layouts: ResponsiveLayouts = {
      desktop: [
        { i: 'a', x: 0, y: 0, w: 3, h: 2 },
        { i: 'b', x: 3, y: 0, w: 3, h: 2 },
        { i: 'c', x: 9, y: 0, w: 3, h: 2 },
      ],
      mobile: [{ i: 'a', x: 0, y: 0, w: 1, h: 2 }],
    };

    const mirrored = mirrorResponsiveLayoutsForRtl(layouts);

    expect(mirrored.desktop).toEqual([
      { i: 'a', x: 9, y: 0, w: 3, h: 2 },
      { i: 'b', x: 6, y: 0, w: 3, h: 2 },
      { i: 'c', x: 0, y: 0, w: 3, h: 2 },
    ]);
    expect(mirrored.mobile).toEqual([{ i: 'a', x: 0, y: 0, w: 1, h: 2 }]);
  });

  it('is involutive so store round-trips keep physical coordinates', () => {
    const layouts: ResponsiveLayouts = {
      desktop: [
        { i: 'wide', x: 0, y: 0, w: 12, h: 4 },
        { i: 'left', x: 0, y: 4, w: 4, h: 4 },
        { i: 'right', x: 8, y: 4, w: 4, h: 4 },
      ],
      mobile: [
        { i: 'wide', x: 0, y: 0, w: 1, h: 4 },
        { i: 'left', x: 0, y: 4, w: 1, h: 4 },
      ],
    };

    const roundTrip = mirrorResponsiveLayoutsForRtl(
      mirrorResponsiveLayoutsForRtl(layouts),
    );

    expect(roundTrip).toEqual(layouts);
  });
});
