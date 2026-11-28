import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingOperationDispatchService } from 'src/modules/quotation/services/accounting-operation-dispatch.service';
import {
  type AccountingProbeInput,
  type AccountingProbeOutcome,
} from 'src/modules/quotation/utils/accounting-destination-probe.util';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

// Nest owns permission and persistence. All actual Asan network reads, including
// health, execute through the same fixed private LF, scoped workspace variables,
// exact destination binding and adapter parser as the import path. No direct
// fallback socket when that transport is unavailable.
@Injectable()
export class AccountingDestinationProbeService {
  constructor(private readonly dispatch: AccountingOperationDispatchService) {}

  async probe(input: AccountingProbeInput, authContext: WorkspaceAuthContext, connectionId: string): Promise<AccountingProbeOutcome> {
    const checkedAt = new Date().toISOString();
    if (!input.isLive && input.adapterId === 'mock') {
      return { healthState: 'OK', code: 'REACHABLE', latencyMs: 0, checkedAt,
        detail: 'اتصال آزمایشی در حافظه پاسخ داد؛ هیچ درخواستی به شبکه ارسال نشد' };
    }
    const failed = (code: AccountingProbeOutcome['code'], detail: string): AccountingProbeOutcome =>
      ({ healthState: 'FAILED', code, latencyMs: 0, checkedAt, detail });
    if (input.adapterId !== 'asan' || !connectionId) {
      return failed('DESTINATION_NOT_ALLOWED', 'مسیر خواندن امن برای این اتصال در دسترس نیست');
    }
    try {
      const response = record(await this.dispatch.dispatch('accounting-internal-probe-connection',
        { connectionId }, authContext));
      const health = record(response?.health);
      if (response?.success !== true || health === null) {
        return failed('TRANSPORT_ERROR', 'مسیر امن و تأییدشده اتصال در دسترس نیست');
      }
      if (health.kind === 'REACHABLE' && health.transportIsSecure === true &&
          typeof health.latencyMs === 'number' && Number.isFinite(health.latencyMs) && health.latencyMs >= 0) {
        return { healthState: 'OK', code: 'REACHABLE', checkedAt, latencyMs: health.latencyMs,
          detail: 'پاسخ معتبر کالا از مسیر امن و تأییدشده آسان دریافت شد' };
      }
      const code = health.code === 'TIMEOUT' ? 'TIMEOUT' :
        health.code === 'INVALID_RESPONSE' ? 'INVALID_RESPONSE' : 'TRANSPORT_ERROR';
      return failed(code, code === 'TIMEOUT' ? 'مقصد در زمان مجاز پاسخ نداد' :
        code === 'INVALID_RESPONSE' ? 'پاسخ مقصد فهرست معتبر کالا نیست' : 'مسیر امن و تأییدشده اتصال در دسترس نیست');
    } catch {
      return failed('TRANSPORT_ERROR', 'مسیر امن و تأییدشده اتصال در دسترس نیست');
    }
  }
}
