import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { QuotationUiController } from 'src/modules/quotation/controllers/quotation-ui.controller';
import { QuotationQueryHookModule } from 'src/modules/quotation/query-hooks/quotation-query-hook.module';
import { QuotationCommunicationOutboundService } from 'src/modules/quotation/services/quotation-communication-outbound.service';
import { QuotationCustomerLinkService } from 'src/modules/quotation/services/quotation-customer-link.service';
import { QuotationDraftPersistenceService } from 'src/modules/quotation/services/quotation-draft-persistence.service';
import { QuotationPdfService } from 'src/modules/quotation/services/quotation-pdf.service';
import { QuotationShareService } from 'src/modules/quotation/services/quotation-share.service';
import { QuotationUiService } from 'src/modules/quotation/services/quotation-ui.service';
import { TaxPolicyAuthorityService } from 'src/modules/quotation/services/tax-policy-authority.service';
import { AccountingConnectionAuthorityService } from 'src/modules/quotation/services/accounting-connection-authority.service';
import { AccountingDestinationProbeService } from 'src/modules/quotation/services/accounting-destination-probe.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheModule,
    WorkspaceCacheStorageModule,
    QuotationQueryHookModule,
  ],
  controllers: [QuotationUiController],
  providers: [
    QuotationUiService,
    QuotationPdfService,
    QuotationCustomerLinkService,
    QuotationCommunicationOutboundService,
    QuotationShareService,
    QuotationDraftPersistenceService,
    TaxPolicyAuthorityService,
    AccountingDestinationProbeService,
    AccountingConnectionAuthorityService,
  ],
})
export class QuotationModule {}
