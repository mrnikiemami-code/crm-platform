import { isNonEmptyString } from '@sniptt/guards';
import { Command, Option } from 'nest-commander';

import {
  ProvisionedWorkspaceCommandRunner,
  type ProvisionedWorkspaceCommandOptions,
} from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Keeps the owner of a dependent record equal to the owner of its customer.
//
// WHY THIS LIVES IN THE DATABASE: the row-level rule that scopes a member to their
// records filters on a field of the same object, and it cannot walk a relation. So
// eventLead, eventRegistration, registrationPayment and salesInteraction each
// carry their own owner column, and the only way to keep them equal to
// person.assigneeId for EVERY write path — GraphQL, REST, imports, the app's own
// functions, a manual SQL fix — is inside the writing transaction. Hooks would
// miss at least one of those paths; an asynchronous job would leave a window in
// which a transferred customer stays readable.
//
// The BEFORE trigger does two things and nothing else:
//   * a NULL owner is filled from the customer;
//   * a DIFFERENT owner raises, so a restricted member cannot hand a record to
//     itself, nor attach a record to a customer it cannot see. The write aborts,
//     so no stray row is left behind.
// `soldByRaw` and `performedBy` are never written: access is not sales history.
//
// The customer trigger propagates a transfer with one statement per child table,
// in the same transaction, so an interrupted transfer cannot leave a stale owner.

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.split('"').join('""')}"`;

const SYNC_FUNCTION_NAMES = [
  'sy_record_access_owner_of_person',
  'sy_record_access_resolve',
  'sy_record_access_event_lead',
  'sy_record_access_event_registration',
  'sy_record_access_registration_payment',
  'sy_record_access_sales_interaction',
  'sy_record_access_propagate_person_owner',
];

const SYNC_TRIGGERS: Array<{ name: string; table: string }> = [
  { name: 'sy_record_access_event_lead', table: '_eventLead' },
  { name: 'sy_record_access_event_registration', table: '_eventRegistration' },
  { name: 'sy_record_access_registration_payment', table: '_registrationPayment' },
  { name: 'sy_record_access_sales_interaction', table: '_salesInteraction' },
  { name: 'sy_record_access_person_owner', table: 'person' },
];

const buildRevertSql = (schema: string): string => `
${SYNC_TRIGGERS.map(
  (trigger) =>
    `DROP TRIGGER IF EXISTS ${trigger.name} ON ${schema}."${trigger.table}";`,
).join('\n')}

${SYNC_FUNCTION_NAMES.map(
  (name) => `DROP FUNCTION IF EXISTS ${schema}.${name}();`,
).join('\n')}
DROP FUNCTION IF EXISTS ${schema}.sy_record_access_resolve(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS ${schema}.sy_record_access_owner_of_person(uuid);
`;

const buildInstallSql = (schema: string): string => `
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT p."assigneeId"
    FROM ${schema}.person p
   WHERE p.id = p_person_id AND p."deletedAt" IS NULL;
$$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_resolve(
  p_row_owner uuid,
  p_person_id uuid,
  p_label text,
  INOUT p_result uuid
) LANGUAGE plpgsql AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_person_id IS NULL THEN
    p_result := p_row_owner;
    RETURN;
  END IF;

  v_owner := ${schema}.sy_record_access_owner_of_person(p_person_id);

  IF v_owner IS NULL THEN
    p_result := p_row_owner;
    RETURN;
  END IF;

  IF p_row_owner IS NULL THEN
    p_result := v_owner;
    RETURN;
  END IF;

  IF p_row_owner IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION
      'RECORD_ACCESS_OWNER_MISMATCH: % must belong to the same member as its customer', p_label
      USING ERRCODE = 'PGRAC',
            CONSTRAINT = 'sy_record_access_owner_mismatch';
  END IF;

  p_result := p_row_owner;
END;
$$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_event_lead()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."assignedToId" := ${schema}.sy_record_access_resolve(
    NEW."assignedToId", NEW."personId", 'eventLead', NEW."assignedToId");
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_event_registration()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."assigneeId" := ${schema}.sy_record_access_resolve(
    NEW."assigneeId", NEW."personId", 'eventRegistration', NEW."assigneeId");
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_registration_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_person_id uuid;
BEGIN
  SELECT er."personId" INTO v_person_id
    FROM ${schema}."_eventRegistration" er
   WHERE er.id = NEW."eventRegistrationId";

  NEW."assigneeId" := ${schema}.sy_record_access_resolve(
    NEW."assigneeId", v_person_id, 'registrationPayment', NEW."assigneeId");
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_sales_interaction()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_person_id uuid;
BEGIN
  SELECT el."personId" INTO v_person_id
    FROM ${schema}."_eventLead" el
   WHERE el.id = NEW."eventLeadId";

  NEW."assigneeId" := ${schema}.sy_record_access_resolve(
    NEW."assigneeId", v_person_id, 'salesInteraction', NEW."assigneeId");
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION ${schema}.sy_record_access_propagate_person_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."assigneeId" IS NOT DISTINCT FROM OLD."assigneeId" THEN
    RETURN NULL;
  END IF;

  UPDATE ${schema}."_eventLead"
     SET "assignedToId" = NEW."assigneeId"
   WHERE "personId" = NEW.id
     AND "assignedToId" IS DISTINCT FROM NEW."assigneeId";

  UPDATE ${schema}."_eventRegistration"
     SET "assigneeId" = NEW."assigneeId"
   WHERE "personId" = NEW.id
     AND "assigneeId" IS DISTINCT FROM NEW."assigneeId";

  UPDATE ${schema}."_registrationPayment" rp
     SET "assigneeId" = NEW."assigneeId"
    FROM ${schema}."_eventRegistration" er
   WHERE er.id = rp."eventRegistrationId"
     AND er."personId" = NEW.id
     AND rp."assigneeId" IS DISTINCT FROM NEW."assigneeId";

  UPDATE ${schema}."_salesInteraction" si
     SET "assigneeId" = NEW."assigneeId"
    FROM ${schema}."_eventLead" el
   WHERE el.id = si."eventLeadId"
     AND el."personId" = NEW.id
     AND si."assigneeId" IS DISTINCT FROM NEW."assigneeId";

  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS sy_record_access_event_lead ON ${schema}."_eventLead";
CREATE TRIGGER sy_record_access_event_lead
BEFORE INSERT OR UPDATE OF "personId", "assignedToId"
ON ${schema}."_eventLead"
FOR EACH ROW EXECUTE FUNCTION ${schema}.sy_record_access_event_lead();

DROP TRIGGER IF EXISTS sy_record_access_event_registration ON ${schema}."_eventRegistration";
CREATE TRIGGER sy_record_access_event_registration
BEFORE INSERT OR UPDATE OF "personId", "assigneeId"
ON ${schema}."_eventRegistration"
FOR EACH ROW EXECUTE FUNCTION ${schema}.sy_record_access_event_registration();

DROP TRIGGER IF EXISTS sy_record_access_registration_payment ON ${schema}."_registrationPayment";
CREATE TRIGGER sy_record_access_registration_payment
BEFORE INSERT OR UPDATE OF "eventRegistrationId", "assigneeId"
ON ${schema}."_registrationPayment"
FOR EACH ROW EXECUTE FUNCTION ${schema}.sy_record_access_registration_payment();

DROP TRIGGER IF EXISTS sy_record_access_sales_interaction ON ${schema}."_salesInteraction";
CREATE TRIGGER sy_record_access_sales_interaction
BEFORE INSERT OR UPDATE OF "eventLeadId", "assigneeId"
ON ${schema}."_salesInteraction"
FOR EACH ROW EXECUTE FUNCTION ${schema}.sy_record_access_sales_interaction();

DROP TRIGGER IF EXISTS sy_record_access_person_owner ON ${schema}.person;
CREATE TRIGGER sy_record_access_person_owner
AFTER UPDATE OF "assigneeId"
ON ${schema}.person
FOR EACH ROW EXECUTE FUNCTION ${schema}.sy_record_access_propagate_person_owner();
`;

// Every count the reconcile would change, so the operator sees the size of the
// repair before touching a row.
const buildDriftReportSql = (schema: string): string => `
SELECT 'eventLead' AS object_name, count(*)::int AS rows_to_repair
  FROM ${schema}."_eventLead" el
  JOIN ${schema}.person p ON p.id = el."personId"
 WHERE el."deletedAt" IS NULL AND el."assignedToId" IS DISTINCT FROM p."assigneeId"
UNION ALL
SELECT 'eventRegistration', count(*)::int
  FROM ${schema}."_eventRegistration" er
  JOIN ${schema}.person p ON p.id = er."personId"
 WHERE er."deletedAt" IS NULL AND er."assigneeId" IS DISTINCT FROM p."assigneeId"
UNION ALL
SELECT 'registrationPayment', count(*)::int
  FROM ${schema}."_registrationPayment" rp
  JOIN ${schema}."_eventRegistration" er ON er.id = rp."eventRegistrationId"
  JOIN ${schema}.person p ON p.id = er."personId"
 WHERE rp."deletedAt" IS NULL AND rp."assigneeId" IS DISTINCT FROM p."assigneeId"
UNION ALL
SELECT 'salesInteraction', count(*)::int
  FROM ${schema}."_salesInteraction" si
  JOIN ${schema}."_eventLead" el ON el.id = si."eventLeadId"
  JOIN ${schema}.person p ON p.id = el."personId"
 WHERE si."deletedAt" IS NULL AND si."assigneeId" IS DISTINCT FROM p."assigneeId";
`;

type RecordAccessSyncOptions = ProvisionedWorkspaceCommandOptions & {
  revert?: boolean;
};

@RegisteredWorkspaceCommand('2.42.0', 1794600000000)
@Command({
  name: 'upgrade:2-42:install-record-access-sync',
  description:
    'Install the triggers that keep the owner of leads, registrations, payments and interactions equal to their customer owner (skips workspaces without the owner fields)',
})
export class InstallRecordAccessSyncCommand extends ProvisionedWorkspaceCommandRunner<RecordAccessSyncOptions> {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
  ) {
    super(workspaceIteratorService);
  }

  @Option({
    flags: '--revert',
    description: 'Remove the triggers and functions instead of installing them',
    required: false,
  })
  parseRevert(): boolean {
    return true;
  }

  override async runOnWorkspace({
    workspaceId,
    dataSource,
    options,
  }: RunOnWorkspaceArgs<RecordAccessSyncOptions>): Promise<void> {
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

    if (options.revert) {
      if (options.dryRun) {
        this.logger.log(
          `[dry-run] would remove record access triggers in ${workspace.databaseSchema}`,
        );

        return;
      }

      await dataSource.query(buildRevertSql(quotedSchema));
      this.logger.log(
        `Removed record access triggers in ${workspace.databaseSchema}`,
      );

      return;
    }

    // The triggers assume the owner columns exist; a workspace that never ran the
    // field script must be skipped rather than half-installed.
    const requiredColumns: Array<{ column_name: string }> = await dataSource.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = $1
          AND (   (table_name = 'person' AND column_name = 'assigneeId')
               OR (table_name = '_eventLead' AND column_name = 'assignedToId')
               OR (table_name = '_eventRegistration' AND column_name = 'assigneeId')
               OR (table_name = '_registrationPayment' AND column_name = 'assigneeId')
               OR (table_name = '_salesInteraction' AND column_name = 'assigneeId'))`,
      [workspace.databaseSchema],
    );

    if (requiredColumns.length < 5) {
      this.logger.log(
        `Workspace ${workspaceId} is missing the owner fields (${requiredColumns.length}/5), skipping`,
      );

      return;
    }

    const drift: Array<{ object_name: string; rows_to_repair: number }> =
      await dataSource.query(buildDriftReportSql(quotedSchema));

    for (const row of drift) {
      this.logger.log(
        `${workspace.databaseSchema} ${row.object_name}: ${row.rows_to_repair} row(s) whose owner differs from the customer`,
      );
    }

    if (options.dryRun) {
      this.logger.log(
        `[dry-run] would install record access triggers in ${workspace.databaseSchema}`,
      );

      return;
    }

    await dataSource.query(buildInstallSql(quotedSchema));

    // Existing rows were written before the trigger existed, so the invariant is
    // applied once. It only fills or corrects the owner columns; the sales
    // history columns are untouched.
    await dataSource.query(`
      UPDATE ${quotedSchema}."_eventLead" el
         SET "assignedToId" = p."assigneeId"
        FROM ${quotedSchema}.person p
       WHERE p.id = el."personId" AND el."deletedAt" IS NULL
         AND el."assignedToId" IS DISTINCT FROM p."assigneeId";

      UPDATE ${quotedSchema}."_eventRegistration" er
         SET "assigneeId" = p."assigneeId"
        FROM ${quotedSchema}.person p
       WHERE p.id = er."personId" AND er."deletedAt" IS NULL
         AND er."assigneeId" IS DISTINCT FROM p."assigneeId";
    `);

    this.logger.log(
      `Installed record access triggers and reconciled owners in ${workspace.databaseSchema}`,
    );
  }
}
