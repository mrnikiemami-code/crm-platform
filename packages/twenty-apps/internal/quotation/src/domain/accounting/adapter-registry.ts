import {
  isAccountingAdapterId,
  type AccountingAdapter,
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';
import {
  type AsanFetch,
  AsanHttpAdapter,
} from 'src/domain/accounting/adapters/asan/asan-http-adapter';
import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Executable adapter factory (Node / logic-function / Nest workers only).
// Presentation descriptors live in adapter-descriptors.ts so front components never
// pull AsanHttpAdapter → node:crypto into the browser bundle.
export {
  ADAPTER_DESCRIPTORS,
  CURRENCY_HANDLING_LABELS,
  DUTY_HANDLING_LABELS,
  TAX_HANDLING_LABELS,
  describeCapabilities,
  financialModesFor,
  findAdapterDescriptor,
  type AdapterDescriptor,
  type AdapterReadiness,
  type CapabilityRow,
} from 'src/domain/accounting/adapter-descriptors';

export type CreateAdapterInput = {
  adapterId: unknown;
  settings: ConnectionSettings;
  tunnelToken?: string;
  allowInsecureTransport?: boolean;
  fetchImpl?: AsanFetch;
  now?: () => Date;
  // Test seam: replaces the vendor implementation without asking the factory to guess.
  mock?: MockAccountingAdapter;
};

export const createAccountingAdapter = (
  input: CreateAdapterInput,
): Result<AccountingAdapter> => {
  if (!isAccountingAdapterId(input.adapterId)) {
    return refused(
      'ADAPTER_UNKNOWN',
      'the selected accounting adapter is not implemented',
    );
  }

  if (input.adapterId === 'mock') {
    return accepted(
      input.mock ??
        new MockAccountingAdapter({
          profile: input.settings.financial?.mockProfile,
        }),
    );
  }

  if (input.settings.baseUrl.trim() === '') {
    return refused(
      'ADAPTER_NOT_CONFIGURED',
      'the Asan adapter needs a service address',
    );
  }

  return accepted(
    new AsanHttpAdapter({
      baseUrl: input.settings.baseUrl,
      remoteUserId: input.settings.remoteUserId,
      ...(input.tunnelToken === undefined
        ? {}
        : { tunnelToken: input.tunnelToken }),
      ...(input.allowInsecureTransport === true
        ? { allowInsecureTransport: true }
        : {}),
      ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }),
      ...(input.now === undefined ? {} : { now: input.now }),
    }),
  );
};
