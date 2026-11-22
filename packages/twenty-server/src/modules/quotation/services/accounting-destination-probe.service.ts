import { Injectable } from '@nestjs/common';

import {
  probeAccountingDestination,
  type AccountingProbeInput,
  type AccountingProbeOutcome,
} from 'src/modules/quotation/utils/accounting-destination-probe.util';

// The trusted side of a connection test. The settings route asks this service, not the
// caller, so the stored health row describes a request this process actually made.
@Injectable()
export class AccountingDestinationProbeService {
  probe(input: AccountingProbeInput): Promise<AccountingProbeOutcome> {
    return probeAccountingDestination(input);
  }
}
