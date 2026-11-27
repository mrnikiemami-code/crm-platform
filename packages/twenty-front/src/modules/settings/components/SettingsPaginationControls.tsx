import { styled } from '@linaria/react';
import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type SettingsPaginationControlsProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  hasNextPage?: boolean;
  numbered?: { total: number; pageSize: number; onPageSizeChange: (size: number) => void; locale?: string };
};

const StyledContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-top: ${themeCssVariables.spacing[2]};
`;

export const SettingsPaginationControls = ({
  page,
  pageCount,
  onPageChange,
  isLoading = false,
  hasNextPage,
  numbered,
}: SettingsPaginationControlsProps) => {
  const { t } = useLingui();

  const isNextDisabled = isDefined(hasNextPage)
    ? !hasNextPage
    : page + 1 >= pageCount;

  if (numbered) return <NumberedPagination page={page} pageCount={pageCount} onPageChange={onPageChange} isLoading={isLoading} numbered={numbered} />;

  return (
    <StyledContainer>
      <Button
        size="sm"
        disabled={page === 0 || isLoading}
        onClick={() => onPageChange(page - 1)}
        variant="outline"
      >{t`Previous`}</Button>
      <div>{t`Page ${page + 1} of ${pageCount}`}</div>
      <Button
        size="sm"
        disabled={isNextDisabled || isLoading}
        onClick={() => onPageChange(page + 1)}
        variant="outline"
      >{t`Next`}</Button>
    </StyledContainer>
  );
};

const NumberedPagination = ({ page, pageCount, onPageChange, isLoading, numbered }: Required<Pick<SettingsPaginationControlsProps, 'page' | 'pageCount' | 'onPageChange' | 'isLoading' | 'numbered'>>) => {
  const { t } = useLingui();
  const [jump, setJump] = useState('');
  const fa = numbered.locale?.startsWith('fa') === true;
  const format = (n: number) => n.toLocaleString(numbered.locale ?? 'en-US');
  const last = Math.max(0, pageCount - 1);
  const pages = [...new Set([0, page - 2, page - 1, page, page + 1, page + 2, last].filter((n) => n >= 0 && n <= last))].sort((a, b) => a - b);
  const parse = (value: string) => Number(value.trim().replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))));
  const target = parse(jump);
  const validJump = Number.isSafeInteger(target) && target >= 1 && target <= pageCount;
  const go = (index: number) => { if (!isLoading && index >= 0 && index < pageCount) onPageChange(index); };
  return (
    <StyledContainer aria-label={fa ? 'صفحه‌بندی جدول' : t`Table pagination`}>
      <span aria-live="polite">{numbered.total === 0 ? (fa ? '۰ رکورد' : t`No records`) : fa
        ? 'نمایش ' + format(page * numbered.pageSize + 1) + ' تا ' + format(Math.min((page + 1) * numbered.pageSize, numbered.total)) + ' از ' + format(numbered.total) + ' رکورد'
        : t`Page ${page + 1} of ${pageCount}` + ' · ' + format(numbered.total)}</span>
      <Button size="sm" variant="outline" disabled={page === 0 || isLoading} onClick={() => go(0)}>{fa ? 'اولین' : t`First`}</Button>
      <Button size="sm" variant="outline" disabled={page === 0 || isLoading} onClick={() => go(page - 1)}>{fa ? 'قبلی' : t`Previous`}</Button>
      {numbered.total > 0 && pages.map((index, i) => (
        <span key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && index - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <Button size="sm" variant={index === page ? 'solid' : 'outline'} disabled={isLoading || index === page} onClick={() => go(index)}>{format(index + 1)}</Button>
        </span>
      ))}
      <Button size="sm" variant="outline" disabled={page >= last || isLoading} onClick={() => go(page + 1)}>{fa ? 'بعدی' : t`Next`}</Button>
      <Button size="sm" variant="outline" disabled={page >= last || isLoading} onClick={() => go(last)}>{fa ? 'آخرین' : t`Last`}</Button>
      <label>{fa ? 'تعداد در صفحه' : t`Rows per page`}{' '}
        <select aria-label={fa ? 'تعداد در صفحه' : t`Rows per page`} disabled={isLoading} value={numbered.pageSize} onChange={(event) => numbered.onPageSizeChange(Number(event.target.value))}>
          {[25, 50, 100].map((size) => <option key={size} value={size}>{format(size)}</option>)}
        </select>
      </label>
      <label>{fa ? 'برو به صفحه' : t`Go to page`}{' '}
        <input aria-label={fa ? 'برو به صفحه' : t`Go to page`} value={jump} inputMode="numeric" style={{ width: 64 }} disabled={isLoading} onChange={(event) => setJump(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && validJump) go(target - 1); }} />
      </label>
      <Button size="sm" variant="outline" disabled={!validJump || isLoading} onClick={() => go(target - 1)}>{fa ? 'برو' : t`Go`}</Button>
    </StyledContainer>
  );
};
