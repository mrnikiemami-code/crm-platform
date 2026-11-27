import { styled } from '@linaria/react';
import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { Button, Input, Select } from 'twenty-ui/primitives/input';
import { getNumberedPageWindow, normalizePageDigits, parsePageJump } from '@/settings/utils/numberedPagination';
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

const NumberedFooter = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid ${themeCssVariables.border.color.light};
  background: ${themeCssVariables.background.primary};
  min-width: 0;
  .pagination-count { justify-self: start; }
  .pagination-size { justify-self: end; }
  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
    .pagination-center { grid-column: 1 / -1; grid-row: 1; }
  }
  @media (max-width: 480px) {
    gap: 4px;
    grid-template-columns: minmax(0, 1fr);
    .pagination-center { grid-column: 1; }
    .pagination-count, .pagination-size { justify-self: center; }
  }
`;
const CenterGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
`;
const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
`;

const NumberedPagination = ({ page, pageCount, onPageChange, isLoading, numbered }: Required<Pick<SettingsPaginationControlsProps, 'page' | 'pageCount' | 'onPageChange' | 'isLoading' | 'numbered'>>) => {
  const { t } = useLingui();
  const [jump, setJump] = useState('');
  const fa = numbered.locale?.startsWith('fa') === true;
  const format = (n: number) => n.toLocaleString(numbered.locale ?? 'en-US');
  const last = Math.max(0, pageCount - 1);
  const pages = getNumberedPageWindow(page, numbered.total === 0 ? 0 : pageCount);
  const target = parsePageJump(jump, numbered.total === 0 ? 0 : pageCount);
  const go = (index: number) => {
    if (!isLoading && numbered.total > 0 && index >= 0 && index < pageCount) {
      onPageChange(index);
      setJump('');
    }
  };
  const jumpLabel = fa ? 'برو به صفحه' : t`Go to page`;
  const sizeLabel = fa ? 'تعداد در صفحه' : t`Rows per page`;
  return (
    <NumberedFooter className="acct-numbered-pagination" dir={fa ? 'rtl' : undefined} aria-label={fa ? 'صفحه‌بندی جدول' : t`Table pagination`}>
      <span className="pagination-count" aria-live="polite" style={{ color: themeCssVariables.font.color.secondary }}>
        {numbered.total === 0 ? (fa ? '۰ رکورد' : t`No records`) : fa
          ? 'نمایش ' + format(page * numbered.pageSize + 1) + ' تا ' + format(Math.min((page + 1) * numbered.pageSize, numbered.total)) + ' از ' + format(numbered.total) + ' رکورد'
          : t`Page ${page + 1} of ${pageCount}` + ' · ' + format(numbered.total)}
      </span>
      <CenterGroup className="pagination-center">
        <ControlGroup>
          <Button size="sm" variant="outline" aria-label={fa ? 'اولین صفحه' : t`First page`} title={fa ? 'اولین صفحه' : t`First page`} disabled={page === 0 || isLoading} onClick={() => go(0)}>{fa ? '»' : '«'}</Button>
          <Button size="sm" variant="outline" aria-label={fa ? 'صفحه قبلی' : t`Previous page`} title={fa ? 'صفحه قبلی' : t`Previous page`} disabled={page === 0 || isLoading} onClick={() => go(page - 1)}>{fa ? '›' : '‹'}</Button>
          {pages.map((index) => (
            <Button key={index} size="sm" variant={index === page ? 'solid' : 'outline'} aria-current={index === page ? 'page' : undefined} disabled={isLoading} onClick={() => { if (index !== page) go(index); }} style={{ minWidth: 30 }}>{format(index + 1)}</Button>
          ))}
          <Button size="sm" variant="outline" aria-label={fa ? 'صفحه بعدی' : t`Next page`} title={fa ? 'صفحه بعدی' : t`Next page`} disabled={page >= last || isLoading} onClick={() => go(page + 1)}>{fa ? '‹' : '›'}</Button>
          <Button size="sm" variant="outline" aria-label={fa ? 'آخرین صفحه' : t`Last page`} title={fa ? 'آخرین صفحه' : t`Last page`} disabled={page >= last || isLoading} onClick={() => go(last)}>{fa ? '«' : '»'}</Button>
        </ControlGroup>
        <ControlGroup>
          <span>{jumpLabel}</span>
          <Input size="sm" aria-label={jumpLabel} value={jump} placeholder={format(page + 1)} inputMode="numeric" style={{ width: 68, textAlign: 'center' }}
            disabled={isLoading || numbered.total === 0}
            onChange={(event) => {
              const value = normalizePageDigits(event.target.value);
              if (!/^\d{0,12}$/.test(value)) return;
              setJump(fa ? value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]) : value);
            }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (target !== null) go(target); } }} />
          <Button size="sm" variant="outline" disabled={target === null || isLoading} onClick={() => { if (target !== null) go(target); }}>{fa ? 'برو' : t`Go`}</Button>
        </ControlGroup>
      </CenterGroup>
      <ControlGroup className="pagination-size">
        <span>{sizeLabel}</span>
        <Select.Root value={String(numbered.pageSize)} disabled={isLoading} onValueChange={(value) => { const size = Number(value); if ([25, 50, 100].includes(size)) { setJump(''); numbered.onPageSizeChange(size); } }}>
          <Select.Trigger size="sm" aria-label={sizeLabel}><Select.Value>{format(numbered.pageSize)}</Select.Value></Select.Trigger>
          <Select.Popup side="top">
            {[25, 50, 100].map((size) => <Select.Item key={size} value={String(size)}>{format(size)}</Select.Item>)}
          </Select.Popup>
        </Select.Root>
      </ControlGroup>
    </NumberedFooter>
  );
};
