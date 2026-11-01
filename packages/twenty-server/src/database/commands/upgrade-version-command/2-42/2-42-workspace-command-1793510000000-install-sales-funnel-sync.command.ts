import { isNonEmptyString } from '@sniptt/guards';
import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// The manager dashboard funnel reads a materialised cumulative stage
// (`eventLead.funnelCumulativeRaw`). Keeping that field in sync from the
// write path needs database triggers because the recompute must also cover
// API writes, imports and the metadata side of relation changes, none of
// which share a single server-side hook. Workspaces that never created the
// field are skipped, so this stays a no-op for every other tenant.

const FUNNEL_FIELD_COLUMN = 'funnelCumulativeRaw';

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.split('"').join('""')}"`;

const buildInstallSql = (quotedSchema: string): string => `
CREATE OR REPLACE FUNCTION ${quotedSchema}.sy_funnel_recompute(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_interaction boolean;
  v_has_registration boolean;
  v_target ${quotedSchema}."_eventLead_${FUNNEL_FIELD_COLUMN}_enum"[];
  v_stage text;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ${quotedSchema}."_salesInteraction" si
    WHERE si."eventLeadId" = p_lead_id AND si."deletedAt" IS NULL
  ) INTO v_has_interaction;

  -- Cancelled and refunded registrations are not completed registrations.
  SELECT EXISTS (
    SELECT 1 FROM ${quotedSchema}."_eventRegistration" er
    WHERE er."eventLeadId" = p_lead_id
      AND er."deletedAt" IS NULL
      AND er."registrationStatus"::text NOT IN ('LGWSHDH', 'BZPRDKHTSHDH')
  ) INTO v_has_registration;

  v_target := ARRAY['S1_LEAD'::${quotedSchema}."_eventLead_${FUNNEL_FIELD_COLUMN}_enum"];

  IF v_has_interaction THEN
    v_target := v_target || 'S2_CONTACTED'::${quotedSchema}."_eventLead_${FUNNEL_FIELD_COLUMN}_enum";
  END IF;

  IF v_has_registration THEN
    v_target := v_target || 'S3_REGISTERED'::${quotedSchema}."_eventLead_${FUNNEL_FIELD_COLUMN}_enum";
  END IF;

  v_stage := CASE
    WHEN v_has_registration THEN '۳. ثبت‌نام'
    WHEN v_has_interaction THEN '۲. تماس‌گرفته'
    ELSE '۱. سرنخ'
  END;

  UPDATE ${quotedSchema}."_eventLead" el
  SET "${FUNNEL_FIELD_COLUMN}" = v_target,
      "funnelStageRaw" = v_stage,
      "updatedAt" = now()
  WHERE el.id = p_lead_id
    AND el."deletedAt" IS NULL
    AND (el."${FUNNEL_FIELD_COLUMN}"::text[] IS DISTINCT FROM v_target::text[]
         OR el."funnelStageRaw" IS DISTINCT FROM v_stage);
END;
$$;

CREATE OR REPLACE FUNCTION ${quotedSchema}.sy_funnel_linked_row_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM ${quotedSchema}.sy_funnel_recompute(OLD."eventLeadId");
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM ${quotedSchema}.sy_funnel_recompute(NEW."eventLeadId");
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION ${quotedSchema}.sy_funnel_new_lead_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM ${quotedSchema}.sy_funnel_recompute(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sy_funnel_sales_interaction_sync ON ${quotedSchema}."_salesInteraction";
CREATE TRIGGER sy_funnel_sales_interaction_sync
AFTER INSERT OR DELETE OR UPDATE OF "eventLeadId", "deletedAt"
ON ${quotedSchema}."_salesInteraction"
FOR EACH ROW EXECUTE FUNCTION ${quotedSchema}.sy_funnel_linked_row_sync();

DROP TRIGGER IF EXISTS sy_funnel_event_registration_sync ON ${quotedSchema}."_eventRegistration";
CREATE TRIGGER sy_funnel_event_registration_sync
AFTER INSERT OR DELETE OR UPDATE OF "eventLeadId", "deletedAt", "registrationStatus"
ON ${quotedSchema}."_eventRegistration"
FOR EACH ROW EXECUTE FUNCTION ${quotedSchema}.sy_funnel_linked_row_sync();

DROP TRIGGER IF EXISTS sy_funnel_new_lead_sync ON ${quotedSchema}."_eventLead";
CREATE TRIGGER sy_funnel_new_lead_sync
AFTER INSERT ON ${quotedSchema}."_eventLead"
FOR EACH ROW EXECUTE FUNCTION ${quotedSchema}.sy_funnel_new_lead_sync();

-- Superseded name from an earlier per-environment bootstrap; triggers no longer use it.
DROP FUNCTION IF EXISTS ${quotedSchema}.sy_funnel_sync_trigger();
`;

@RegisteredWorkspaceCommand('2.42.0', 1793510000000)
@Command({
  name: 'upgrade:2-42:install-sales-funnel-sync',
  description:
    'Install the idempotent triggers that keep eventLead cumulative funnel membership in sync (skips workspaces without the funnel field)',
})
export class InstallSalesFunnelSyncCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(protected readonly workspaceIteratorService: WorkspaceIteratorService) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    dataSource,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    if (!dataSource) {
      this.logger.warn(`No data source for workspace ${workspaceId}, skipping`);

      return;
    }

    const [workspace]: Array<{ databaseSchema: string | null }> =
      await dataSource.query(
        `SELECT "databaseSchema" FROM core."workspace" WHERE id = $1`,
        [workspaceId],
      );

    if (!isNonEmptyString(workspace?.databaseSchema)) {
      this.logger.warn(`Workspace ${workspaceId} has no schema, skipping`);

      return;
    }

    const quotedSchema = quoteIdentifier(workspace.databaseSchema);

    const funnelColumns: Array<{ column_name: string }> =
      await dataSource.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = '_eventLead' AND column_name = $2`,
        [workspace.databaseSchema, FUNNEL_FIELD_COLUMN],
      );

    if (funnelColumns.length === 0) {
      this.logger.log(
        `Workspace ${workspaceId} has no funnel field, skipping (nothing to sync)`,
      );

      return;
    }

    if (options.dryRun) {
      this.logger.log(
        `[dry-run] would install sales funnel sync triggers in ${workspace.databaseSchema}`,
      );

      return;
    }

    await dataSource.query(buildInstallSql(quotedSchema));

    this.logger.log(
      `Installed sales funnel sync triggers in ${workspace.databaseSchema}`,
    );
  }
}
