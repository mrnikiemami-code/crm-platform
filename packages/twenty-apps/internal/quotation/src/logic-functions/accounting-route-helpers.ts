import { type RoutePayload } from 'twenty-sdk/define';

import { type AccountingAdapter } from 'src/domain/accounting/adapter-contract';
import {
  buildAdapter,
  readAdapterSecrets,
  type AccountingConnectionRecord,
  type AdapterSecrets,
} from 'src/services/accounting-connection.service';
import { type Result } from 'src/domain/shared/result';

// Shared plumbing for the three accounting HTTP routes. Kept out of the route files so a
// test can exercise one action without booting the SDK definition.

export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const readBody = (event: RoutePayload<unknown>): Record<string, unknown> =>
  asRecord(event.body);

// The worker materialises workspace application variables into process.env. Secrets are
// read here, on the server side of the route, and never returned to the caller.
export const readRouteSecrets = (): AdapterSecrets =>
  readAdapterSecrets(
    process.env as unknown as Record<string, string | undefined>,
  );

export const isAppInstalled = (): boolean =>
  Boolean(process.env.TWENTY_API_URL && process.env.TWENTY_APP_ACCESS_TOKEN);

export const readOutboundFlags = (
  body: Record<string, unknown>,
): {
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  maxAttempts: number;
  reconciled: boolean;
} => ({
  outboundEnabled: process.env.ACCOUNTING_OUTBOUND_ENABLED === 'true',
  documentExportEnabled:
    process.env.ACCOUNTING_DOCUMENT_EXPORT_ENABLED === 'true',
  maxAttempts: 3,
  reconciled: body.reconciled === true,
});

export const adapterForConnection = (
  record: AccountingConnectionRecord,
  secrets: AdapterSecrets,
): Result<AccountingAdapter> => buildAdapter(record, secrets);

export const failure = (
  code: string,
  message: string,
): { success: false; code: string; message: string } => ({
  success: false,
  code,
  message,
});

export const appNotInstalled = (): {
  success: false;
  code: string;
  message: string;
} =>
  failure(
    'APP_NOT_INSTALLED',
    'اپ پیش‌فاکتور روی این فضای کاری نصب نشده است؛ عملیات حسابداری در دسترس نیست.',
  );
