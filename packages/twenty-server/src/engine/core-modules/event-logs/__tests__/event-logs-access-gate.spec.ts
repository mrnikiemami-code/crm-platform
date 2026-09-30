import { EventLogTable } from 'twenty-shared/types';

import { type ClickHouseService } from 'src/database/clickhouse/clickhouse.service';
import { EnterpriseFeaturesEnabledGuard } from 'src/engine/core-modules/auth/guards/enterprise-features-enabled.guard';
import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { type EnterprisePlanService } from 'src/engine/core-modules/enterprise/services/enterprise-plan.service';
import { EventLogsExceptionCode } from 'src/engine/core-modules/event-logs/event-logs.exception';
import { EventLogsService } from 'src/engine/core-modules/event-logs/event-logs.service';
import { EVENT_LOG_TYPES } from 'src/engine/core-modules/event-logs/registry/event-log-registry';
import { type GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';

const WORKSPACE_ID = '20202020-0000-4000-8000-000000000000';

const ENTITLED_TABLES = Object.values(EventLogTable).filter(
  (table) => EVENT_LOG_TYPES[table].requiresEntitlement !== null,
);
const FREE_TABLES = Object.values(EventLogTable).filter(
  (table) => EVENT_LOG_TYPES[table].requiresEntitlement === null,
);

const buildEventLogsService = ({
  hasClickHouse,
  isEnterpriseValid,
  hasEntitlement,
}: {
  hasClickHouse: boolean;
  isEnterpriseValid: boolean;
  hasEntitlement: boolean;
}) => {
  const billingService = {
    hasEntitlement: jest.fn().mockResolvedValue(hasEntitlement),
  };

  const service = new EventLogsService(
    {
      getMainClient: () => (hasClickHouse ? {} : undefined),
    } as unknown as ClickHouseService,
    billingService as unknown as BillingService,
    {
      isValid: () => isEnterpriseValid,
    } as unknown as EnterprisePlanService,
    {} as never,
  );

  return { service, billingService };
};

describe('Organization feature gates', () => {
  describe('audit logs', () => {
    it.each(Object.values(EventLogTable))(
      'requires ClickHouse before any entitlement check (%s)',
      async (table) => {
        const { service } = buildEventLogsService({
          hasClickHouse: false,
          isEnterpriseValid: true,
          hasEntitlement: true,
        });

        await expect(
          service.validateAccess(WORKSPACE_ID, table),
        ).rejects.toMatchObject({
          code: EventLogsExceptionCode.CLICKHOUSE_NOT_CONFIGURED,
        });
      },
    );

    it.each(ENTITLED_TABLES)(
      'denies access without a valid enterprise validity token (%s)',
      async (table) => {
        const { service, billingService } = buildEventLogsService({
          hasClickHouse: true,
          isEnterpriseValid: false,
          hasEntitlement: true,
        });

        await expect(
          service.validateAccess(WORKSPACE_ID, table),
        ).rejects.toMatchObject({
          code: EventLogsExceptionCode.NO_ENTITLEMENT,
        });
        expect(billingService.hasEntitlement).not.toHaveBeenCalled();
      },
    );

    it.each(FREE_TABLES)(
      'keeps free log types available without an enterprise plan (%s)',
      async (table) => {
        const { service } = buildEventLogsService({
          hasClickHouse: true,
          isEnterpriseValid: false,
          hasEntitlement: false,
        });

        await expect(
          service.validateAccess(WORKSPACE_ID, table),
        ).resolves.toBeUndefined();
      },
    );

    it('denies access when the workspace lacks the audit logs entitlement', async () => {
      const { service } = buildEventLogsService({
        hasClickHouse: true,
        isEnterpriseValid: true,
        hasEntitlement: false,
      });

      await expect(
        service.validateAccess(WORKSPACE_ID, EventLogTable.WORKSPACE_EVENT),
      ).rejects.toMatchObject({
        code: EventLogsExceptionCode.NO_ENTITLEMENT,
      });
    });

    it('grants access with ClickHouse, a valid enterprise plan and the entitlement', async () => {
      const { service } = buildEventLogsService({
        hasClickHouse: true,
        isEnterpriseValid: true,
        hasEntitlement: true,
      });

      await expect(
        service.validateAccess(WORKSPACE_ID, EventLogTable.WORKSPACE_EVENT),
      ).resolves.toBeUndefined();
    });
  });

  describe('SSO', () => {
    const buildGuard = (isEnterpriseValid: boolean) => {
      const guardRedirectService = {
        dispatchErrorFromGuard: jest.fn(),
        getSubdomainAndCustomDomainFromContext: jest.fn(),
      };

      const guard = new EnterpriseFeaturesEnabledGuard(
        guardRedirectService as unknown as GuardRedirectService,
        { isValid: () => isEnterpriseValid } as EnterprisePlanService,
      );

      return { guard, guardRedirectService };
    };

    it('blocks enterprise endpoints without a valid enterprise validity token', () => {
      const { guard, guardRedirectService } = buildGuard(false);

      expect(guard.canActivate({} as never)).toBe(false);
      expect(guardRedirectService.dispatchErrorFromGuard).toHaveBeenCalled();
    });

    it('allows enterprise endpoints with a valid enterprise validity token', () => {
      const { guard } = buildGuard(true);

      expect(guard.canActivate({} as never)).toBe(true);
    });
  });
});
