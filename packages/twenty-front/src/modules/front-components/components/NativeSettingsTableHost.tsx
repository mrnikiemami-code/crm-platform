import { forwardRef, type CSSProperties, type ReactNode, type ElementType } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { SettingsPaginationControls } from '@/settings/components/SettingsPaginationControls';
import { Table } from '@/ui/layout/table/components/Table';
import { TableBody } from '@/ui/layout/table/components/TableBody';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableCell } from '@/ui/layout/table/components/TableCell';

type Props = { children?: ReactNode; style?: CSSProperties; id?: string; title?: string; 'aria-label'?: string; 'data-connection-id'?: string; 'data-default'?: string; onClick?: (event: unknown) => void; colSpan?: number | string; };
const NativeTable = forwardRef<HTMLDivElement, Props>(({ children, style, ...props }, ref) => <Table ref={ref} role="table" aria-label={props['aria-label']} style={{ minWidth: style?.minWidth }}>{children}</Table>);
const NativeHead = forwardRef<HTMLDivElement, Props>(({ children }, ref) => <div ref={ref} role="rowgroup" style={{ position: 'sticky', top: 0, background: themeCssVariables.background.primary, zIndex: 1 }}>{children}</div>);
const NativeBody = forwardRef<HTMLDivElement, Props>(({ children }, ref) => <TableBody ref={ref} role="rowgroup">{children}</TableBody>);
const NativeRow = forwardRef<HTMLDivElement, Props>(({ children, style, ...props }, ref) => <TableRow ref={ref} id={props.id} role="row" dataAttributes={{ ...(typeof props['data-connection-id'] === 'string' ? { 'data-connection-id': props['data-connection-id'] } : {}), ...(typeof props['data-default'] === 'string' ? { 'data-default': props['data-default'] } : {}) }} gridTemplateColumns={style?.gridTemplateColumns} style={style}>{children}</TableRow>);
const NativeHeader = forwardRef<HTMLDivElement, Props>(({ children }, ref) => <TableHeader ref={ref} role="columnheader" style={{ justifyContent: 'flex-start', textAlign: 'start', minWidth: 0 }}>{children}</TableHeader>);
const NativeCell = forwardRef<HTMLDivElement, Props>(({ children, style, colSpan }, ref) => <TableCell ref={ref} role="cell" height="auto" minWidth="0" style={{ minHeight: 32, direction: style?.direction, justifyContent: style?.direction === 'ltr' ? 'flex-end' : 'flex-start', textAlign: 'right', gridColumn: Number(colSpan) > 1 ? 'span ' + Number(colSpan) : undefined }}>{children}</TableCell>);

// The worker sends presentation-only state through an existing remote HTML
// event. It cannot call CRM functions or choose a native component dynamically.
const NativePager = forwardRef<HTMLDivElement, Props>(({ title, onClick }, ref) => {
  let config: { page?: number; total?: number; size?: number; busy?: boolean } = {};
  try { config = JSON.parse(title ?? '{}'); } catch { return null; }
  const { page, total, size, busy } = config;
  if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1 ||
      typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 ||
      typeof size !== 'number' || ![25, 50, 100].includes(size) ||
      page > Math.max(1, Math.ceil(total / size))) return null;
  const send = (value: string) => onClick?.({ type: 'click', target: { value } });
  return <div ref={ref} style={{ flexShrink: 0, minWidth: 0, width: '100%' }}><SettingsPaginationControls page={page - 1} pageCount={Math.max(1, Math.ceil(total / size))} isLoading={busy === true}
    onPageChange={(index) => send('page:' + (index + 1))}
    numbered={{ total, pageSize: size, locale: 'fa-IR', onPageSizeChange: (next) => send('size:' + next) }} /></div>;
});
const optIn = (marker: string, component: ElementType) => (props: Readonly<Record<string, unknown>>) => props.className === marker ? component : undefined;
// No dynamic registry access from the guest. Unmarked HTML renders exactly as before.
export const nativeSettingsTableResolvers = {
  table: optIn('twenty-native-settings-table', NativeTable),
  thead: optIn('twenty-native-settings-head', NativeHead),
  tbody: optIn('twenty-native-settings-body', NativeBody),
  tr: optIn('twenty-native-settings-row', NativeRow),
  th: optIn('twenty-native-settings-header', NativeHeader),
  td: optIn('twenty-native-settings-cell', NativeCell),
  div: optIn('twenty-native-settings-pager', NativePager),
};
