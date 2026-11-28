import { Module } from '@nestjs/common';

import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { AccountingConnectionCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-create-many.pre-query.hook';
import { AccountingConnectionCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-create-one.pre-query.hook';
import { AccountingConnectionDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-delete-many.pre-query.hook';
import { AccountingConnectionDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-delete-one.pre-query.hook';
import { AccountingConnectionDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-destroy-many.pre-query.hook';
import { AccountingConnectionDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-destroy-one.pre-query.hook';
import { AccountingConnectionMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-merge-many.pre-query.hook';
import { AccountingConnectionRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-restore-many.pre-query.hook';
import { AccountingConnectionRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-restore-one.pre-query.hook';
import { AccountingConnectionUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-update-many.pre-query.hook';
import { AccountingConnectionUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-update-one.pre-query.hook';
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
import { TaxPolicyCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-create-many.pre-query.hook';
import { TaxPolicyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-create-one.pre-query.hook';
import { TaxPolicyDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-delete-many.pre-query.hook';
import { TaxPolicyDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-delete-one.pre-query.hook';
import { TaxPolicyDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-destroy-many.pre-query.hook';
import { TaxPolicyDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-destroy-one.pre-query.hook';
import { TaxPolicyMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-merge-many.pre-query.hook';
import { TaxPolicyRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-restore-many.pre-query.hook';
import { TaxPolicyRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-restore-one.pre-query.hook';
import { TaxPolicyUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-update-many.pre-query.hook';
import { TaxPolicyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-update-one.pre-query.hook';
import { QuotationCurrencyCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-create-many.pre-query.hook';
import { QuotationCurrencyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-create-one.pre-query.hook';
import { QuotationCurrencyDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-delete-many.pre-query.hook';
import { QuotationCurrencyDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-delete-one.pre-query.hook';
import { QuotationCurrencyDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-destroy-many.pre-query.hook';
import { QuotationCurrencyDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-destroy-one.pre-query.hook';
import { QuotationCurrencyMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-merge-many.pre-query.hook';
import { QuotationUnitCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-create-many.pre-query.hook';
import { QuotationUnitCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-create-one.pre-query.hook';
import { QuotationUnitDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-delete-many.pre-query.hook';
import { QuotationUnitDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-delete-one.pre-query.hook';
import { QuotationUnitDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-destroy-many.pre-query.hook';
import { QuotationUnitDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-destroy-one.pre-query.hook';
import { QuotationUnitMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-merge-many.pre-query.hook';
import { QuotationUnitRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-restore-many.pre-query.hook';
import { QuotationUnitRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-restore-one.pre-query.hook';
import { QuotationUnitUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-update-many.pre-query.hook';
import { QuotationUnitUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-update-one.pre-query.hook';
import { QuotationCurrencyRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-restore-many.pre-query.hook';
import { QuotationCurrencyRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-restore-one.pre-query.hook';
import { QuotationCurrencyUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-update-many.pre-query.hook';
import { QuotationCurrencyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-update-one.pre-query.hook';
import { QuotationUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-many.pre-query.hook';
import { QuotationUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-one.pre-query.hook';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';
import { QuotationNumberService } from 'src/modules/quotation/services/quotation-number.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { QuotationRevisionService } from 'src/modules/quotation/services/quotation-revision.service';
import { QuotationRevisionWriteGuardService } from 'src/modules/quotation/services/quotation-revision-write-guard.service';
import { AccountingConnectionWriteGuardService } from 'src/modules/quotation/services/accounting-connection-write-guard.service';
import { QuotationCurrencyWriteGuardService } from 'src/modules/quotation/services/quotation-currency-write-guard.service';
import { QuotationUnitWriteGuardService } from 'src/modules/quotation/services/quotation-unit-write-guard.service';
import { TaxPolicyWriteGuardService } from 'src/modules/quotation/services/tax-policy-write-guard.service';
import { RoundingRuleWriteGuardService } from 'src/modules/quotation/services/rounding-rule-write-guard.service';
import { RoundingRuleCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-create-many.pre-query.hook';
import { RoundingRuleCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-create-one.pre-query.hook';
import { RoundingRuleDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-delete-many.pre-query.hook';
import { RoundingRuleDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-delete-one.pre-query.hook';
import { RoundingRuleDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-destroy-many.pre-query.hook';
import { RoundingRuleDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-destroy-one.pre-query.hook';
import { RoundingRuleMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-merge-many.pre-query.hook';
import { RoundingRuleRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-restore-many.pre-query.hook';
import { RoundingRuleRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-restore-one.pre-query.hook';
import { RoundingRuleUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-update-many.pre-query.hook';
import { RoundingRuleUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/rounding-rule-update-one.pre-query.hook';

import { AccountingPartyWriteGuardService } from 'src/modules/quotation/services/accounting-party-write-guard.service';
import { AccountingPersonCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-create-one.pre-query.hook';
import { AccountingPersonCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-create-many.pre-query.hook';
import { AccountingPersonUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-update-one.pre-query.hook';
import { AccountingPersonUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-update-many.pre-query.hook';
import { AccountingPersonMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-merge-many.pre-query.hook';
import { AccountingPersonRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-restore-one.pre-query.hook';
import { AccountingPersonRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-restore-many.pre-query.hook';
import { AccountingCompanyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-create-one.pre-query.hook';
import { AccountingCompanyCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-create-many.pre-query.hook';
import { AccountingCompanyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-update-one.pre-query.hook';
import { AccountingCompanyUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-update-many.pre-query.hook';
import { AccountingCompanyMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-merge-many.pre-query.hook';
import { AccountingCompanyRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-restore-one.pre-query.hook';
import { AccountingCompanyRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-restore-many.pre-query.hook';

@Module({
  imports: [WorkspaceCacheModule],
  providers: [
    AccountingPartyWriteGuardService,
    AccountingPersonCreateOnePreQueryHook,
    AccountingPersonCreateManyPreQueryHook,
    AccountingPersonUpdateOnePreQueryHook,
    AccountingPersonUpdateManyPreQueryHook,
    AccountingPersonMergeManyPreQueryHook,
    AccountingPersonRestoreOnePreQueryHook,
    AccountingPersonRestoreManyPreQueryHook,
    AccountingCompanyCreateOnePreQueryHook,
    AccountingCompanyCreateManyPreQueryHook,
    AccountingCompanyUpdateOnePreQueryHook,
    AccountingCompanyUpdateManyPreQueryHook,
    AccountingCompanyMergeManyPreQueryHook,
    AccountingCompanyRestoreOnePreQueryHook,
    AccountingCompanyRestoreManyPreQueryHook,
    QuotationPermissionService,
    QuotationNumberService,
    QuotationRevisionService,
    QuotationImmutabilityService,
    QuotationRevisionWriteGuardService,
    AccountingConnectionWriteGuardService,
    TaxPolicyWriteGuardService,
    QuotationCurrencyWriteGuardService,
    QuotationUnitWriteGuardService,
    RoundingRuleWriteGuardService,
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
    TaxPolicyCreateOnePreQueryHook,
    TaxPolicyCreateManyPreQueryHook,
    TaxPolicyUpdateOnePreQueryHook,
    TaxPolicyUpdateManyPreQueryHook,
    TaxPolicyDeleteOnePreQueryHook,
    TaxPolicyDeleteManyPreQueryHook,
    TaxPolicyDestroyOnePreQueryHook,
    TaxPolicyDestroyManyPreQueryHook,
    TaxPolicyRestoreOnePreQueryHook,
    TaxPolicyRestoreManyPreQueryHook,
    TaxPolicyMergeManyPreQueryHook,
    QuotationCurrencyCreateOnePreQueryHook,
    QuotationCurrencyCreateManyPreQueryHook,
    QuotationCurrencyUpdateOnePreQueryHook,
    QuotationCurrencyUpdateManyPreQueryHook,
    QuotationCurrencyDeleteOnePreQueryHook,
    QuotationCurrencyDeleteManyPreQueryHook,
    QuotationCurrencyDestroyOnePreQueryHook,
    QuotationCurrencyDestroyManyPreQueryHook,
    QuotationCurrencyRestoreOnePreQueryHook,
    QuotationCurrencyRestoreManyPreQueryHook,
    QuotationCurrencyMergeManyPreQueryHook,
    QuotationUnitCreateOnePreQueryHook,
    QuotationUnitCreateManyPreQueryHook,
    QuotationUnitUpdateOnePreQueryHook,
    QuotationUnitUpdateManyPreQueryHook,
    QuotationUnitDeleteOnePreQueryHook,
    QuotationUnitDeleteManyPreQueryHook,
    QuotationUnitDestroyOnePreQueryHook,
    QuotationUnitDestroyManyPreQueryHook,
    QuotationUnitRestoreOnePreQueryHook,
    QuotationUnitRestoreManyPreQueryHook,
    QuotationUnitMergeManyPreQueryHook,
    RoundingRuleCreateOnePreQueryHook,
    RoundingRuleCreateManyPreQueryHook,
    RoundingRuleUpdateOnePreQueryHook,
    RoundingRuleUpdateManyPreQueryHook,
    RoundingRuleDeleteOnePreQueryHook,
    RoundingRuleDeleteManyPreQueryHook,
    RoundingRuleDestroyOnePreQueryHook,
    RoundingRuleDestroyManyPreQueryHook,
    RoundingRuleRestoreOnePreQueryHook,
    RoundingRuleRestoreManyPreQueryHook,
    RoundingRuleMergeManyPreQueryHook,
    AccountingConnectionCreateOnePreQueryHook,
    AccountingConnectionCreateManyPreQueryHook,
    AccountingConnectionUpdateOnePreQueryHook,
    AccountingConnectionUpdateManyPreQueryHook,
    AccountingConnectionDeleteOnePreQueryHook,
    AccountingConnectionDeleteManyPreQueryHook,
    AccountingConnectionDestroyOnePreQueryHook,
    AccountingConnectionDestroyManyPreQueryHook,
    AccountingConnectionRestoreOnePreQueryHook,
    AccountingConnectionRestoreManyPreQueryHook,
    AccountingConnectionMergeManyPreQueryHook,
  ],
  exports: [
    QuotationPermissionService,
    QuotationNumberService,
    QuotationImmutabilityService,
  ],
})
export class QuotationQueryHookModule {}
