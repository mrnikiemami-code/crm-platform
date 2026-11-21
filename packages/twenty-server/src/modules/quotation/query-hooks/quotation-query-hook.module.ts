import { Module } from '@nestjs/common';

import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { QuotationDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-delete-many.pre-query.hook';
import { QuotationDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-delete-one.pre-query.hook';
import { QuotationDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-destroy-many.pre-query.hook';
import { QuotationDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-destroy-one.pre-query.hook';
import { QuotationLineCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-create-many.pre-query.hook';
import { QuotationLineCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-create-one.pre-query.hook';
import { QuotationLineDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-delete-many.pre-query.hook';
import { QuotationLineDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-delete-one.pre-query.hook';
import { QuotationLineDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-destroy-one.pre-query.hook';
import { QuotationLineUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-update-many.pre-query.hook';
import { QuotationLineUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-update-one.pre-query.hook';
import { QuotationRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-restore-one.pre-query.hook';
import { QuotationRevisionCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-create-many.pre-query.hook';
import { QuotationRevisionCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-create-one.pre-query.hook';
import { QuotationRevisionDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-delete-many.pre-query.hook';
import { QuotationRevisionDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-delete-one.pre-query.hook';
import { QuotationRevisionDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-destroy-many.pre-query.hook';
import { QuotationRevisionDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-destroy-one.pre-query.hook';
import { QuotationRevisionRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-restore-many.pre-query.hook';
import { QuotationRevisionRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-restore-one.pre-query.hook';
import { QuotationRevisionUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-update-many.pre-query.hook';
import { QuotationRevisionUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-update-one.pre-query.hook';
import { QuotationUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-many.pre-query.hook';
import { QuotationUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-one.pre-query.hook';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';
import { QuotationNumberService } from 'src/modules/quotation/services/quotation-number.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { QuotationRevisionService } from 'src/modules/quotation/services/quotation-revision.service';
import { QuotationRevisionWriteGuardService } from 'src/modules/quotation/services/quotation-revision-write-guard.service';

@Module({
  imports: [WorkspaceCacheModule],
  providers: [
    QuotationPermissionService,
    QuotationNumberService,
    QuotationRevisionService,
    QuotationImmutabilityService,
    QuotationRevisionWriteGuardService,
    QuotationUpdateOnePreQueryHook,
    QuotationUpdateManyPreQueryHook,
    QuotationDeleteOnePreQueryHook,
    QuotationDeleteManyPreQueryHook,
    QuotationDestroyOnePreQueryHook,
    QuotationDestroyManyPreQueryHook,
    QuotationRestoreOnePreQueryHook,
    QuotationLineCreateOnePreQueryHook,
    QuotationLineCreateManyPreQueryHook,
    QuotationLineUpdateOnePreQueryHook,
    QuotationLineUpdateManyPreQueryHook,
    QuotationLineDeleteOnePreQueryHook,
    QuotationLineDeleteManyPreQueryHook,
    QuotationLineDestroyOnePreQueryHook,
    QuotationRevisionCreateOnePreQueryHook,
    QuotationRevisionCreateManyPreQueryHook,
    QuotationRevisionUpdateOnePreQueryHook,
    QuotationRevisionUpdateManyPreQueryHook,
    QuotationRevisionDeleteOnePreQueryHook,
    QuotationRevisionDeleteManyPreQueryHook,
    QuotationRevisionDestroyOnePreQueryHook,
    QuotationRevisionDestroyManyPreQueryHook,
    QuotationRevisionRestoreOnePreQueryHook,
    QuotationRevisionRestoreManyPreQueryHook,
  ],
  exports: [
    QuotationPermissionService,
    QuotationNumberService,
    QuotationImmutabilityService,
  ],
})
export class QuotationQueryHookModule {}
