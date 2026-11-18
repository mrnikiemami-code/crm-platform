import { Module } from '@nestjs/common';

import { QuotationLineCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-create-many.pre-query.hook';
import { QuotationLineCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-create-one.pre-query.hook';
import { QuotationLineDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-delete-one.pre-query.hook';
import { QuotationLineDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-destroy-one.pre-query.hook';
import { QuotationLineUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-update-many.pre-query.hook';
import { QuotationLineUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-line-update-one.pre-query.hook';
import { QuotationDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-delete-one.pre-query.hook';
import { QuotationDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-destroy-one.pre-query.hook';
import { QuotationUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-many.pre-query.hook';
import { QuotationUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-one.pre-query.hook';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';

@Module({
  providers: [
    QuotationImmutabilityService,
    QuotationUpdateOnePreQueryHook,
    QuotationUpdateManyPreQueryHook,
    QuotationDeleteOnePreQueryHook,
    QuotationDestroyOnePreQueryHook,
    QuotationLineCreateOnePreQueryHook,
    QuotationLineCreateManyPreQueryHook,
    QuotationLineUpdateOnePreQueryHook,
    QuotationLineUpdateManyPreQueryHook,
    QuotationLineDeleteOnePreQueryHook,
    QuotationLineDestroyOnePreQueryHook,
  ],
})
export class QuotationQueryHookModule {}
