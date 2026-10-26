import { ELLIPSIS_LENGTH } from '@/page-layout/widgets/graph/utils/ellipsisLength';

const segmentGraphemes = (value: string): string[] => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });

    return Array.from(segmenter.segment(value), (segment) => segment.segment);
  }

  return Array.from(value);
};

export const truncateTickLabel = (
  value: string | number,
  maxLength: number,
): string => {
  const stringValue = String(value);
  const graphemes = segmentGraphemes(stringValue);

  if (graphemes.length <= maxLength) {
    return stringValue;
  }

  if (maxLength <= ELLIPSIS_LENGTH) {
    return '...'.slice(0, Math.max(0, maxLength));
  }

  return `${graphemes.slice(0, maxLength - ELLIPSIS_LENGTH).join('')}...`;
};
