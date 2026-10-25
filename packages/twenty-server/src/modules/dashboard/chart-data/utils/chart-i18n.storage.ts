import { AsyncLocalStorage } from 'async_hooks';

import { type I18n, i18n as globalI18n } from '@lingui/core';

const chartI18nStorage = new AsyncLocalStorage<I18n>();

// Chart label builders call t`…` / msg via this store so they honor the
// request locale; the process-global i18n instance stays on SOURCE_LOCALE.
export const getChartI18n = (): I18n =>
  chartI18nStorage.getStore() ?? globalI18n;

export const withChartI18n = <TResult>(
  localeI18n: I18n,
  callback: () => TResult,
): TResult => chartI18nStorage.run(localeI18n, callback);
