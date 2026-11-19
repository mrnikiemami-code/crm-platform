import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { QuotationUiController } from 'src/modules/quotation/controllers/quotation-ui.controller';
import { QuotationQueryHookModule } from 'src/modules/quotation/query-hooks/quotation-query-hook.module';
import { QuotationPdfService } from 'src/modules/quotation/services/quotation-pdf.service';
import { QuotationUiService } from 'src/modules/quotation/services/quotation-ui.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheModule,
    WorkspaceCacheStorageModule,
    QuotationQueryHookModule,
  ],
  controllers: [QuotationUiController],
  providers: [QuotationUiService, QuotationPdfService],
})
export class QuotationModule {}
