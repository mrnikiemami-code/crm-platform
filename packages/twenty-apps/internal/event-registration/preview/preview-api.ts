// Preview replacement for `src/components/registration-api`.
//
// A real host would POST to the app's HTTP route and let the Logic Function run
// on the server. No such route exists here (the app is not installed), so the
// SAME service functions the Logic Function calls run directly in this harness,
// against the real Dev workspace through a local proxy.
//
// Saving is refused unconditionally: the preview must not be able to create a
// registration or a payment.

import { executeRecordGraphql } from 'src/data/record-api';
import { prepareRegistration } from 'src/services/prepare-registration.service';

export type AppRouteResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

export const PREPARE_ROUTE = '/event-registration/prepare';
export const SAVE_ROUTE = '/event-registration/save';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const callAppRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  if (path === PREPARE_ROUTE) {
    const result = await prepareRegistration(
      {
        sourceObjectNameSingular: readString(body.sourceObjectNameSingular),
        sourceRecordId: readString(body.sourceRecordId),
      },
      { execute: executeRecordGraphql },
    );

    return {
      ok: true,
      status: 200,
      data: result as unknown as Record<string, unknown>,
    };
  }

  if (path === SAVE_ROUTE) {
    // Deliberately a refusal, not a simulation: nothing is written, and no code
    // path reaches a create mutation in this harness.
    return {
      ok: false,
      status: 403,
      data: {
        success: false,
        outcome: {
          kind: 'FAILED',
          message: 'حالت پیش‌نمایش است: ذخیره در این نسخه غیرفعال است.',
        },
      },
    };
  }

  return {
    ok: false,
    status: 404,
    data: { success: false, outcome: { kind: 'FAILED', message: 'Unknown route' } },
  };
};
