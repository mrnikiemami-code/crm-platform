import { readFileSync, writeFileSync } from 'node:fs';

import { buildPaymentTitle } from 'src/domain/record-title';

// One-off repair for payments stored before titles existed.
//
// The rows are READ from Postgres by the caller (a plain SELECT, see
// `backfill-payment-titles.sql`) and handed in as TSV, so this script never
// decides WHICH records to touch — it only composes the same title the app now
// writes, through the same function. Input columns, tab separated:
//
//   id  amountToman  personFirstName  personLastName  eventName  leadName
//
// A literal `\N` means NULL. Output is a pair of SQL files:
//   <prefix>-up.sql    — fills `name` only where it is still empty
//   <prefix>-down.sql  — restores exactly those rows to NULL
//
// Nothing is created, and no row that already has a title is in scope: the
// UPDATE carries the empty-name guard even though the SELECT already filtered.

const NULL_MARKER = '\\N';

const read = (value: string): string | null => {
  const trimmed = value.trim();

  return trimmed.length === 0 || trimmed === NULL_MARKER ? null : trimmed;
};

const joinName = (first: string | null, last: string | null): string | null => {
  const parts = [first, last].filter(
    (part): part is string => part !== null && part.length > 0,
  );

  return parts.length > 0 ? parts.join(' ') : null;
};

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const [inputPath, prefix] = process.argv.slice(2);
const workspaceSchema = process.env.WORKSPACE_SCHEMA ?? '';

if (!/^workspace_[a-z0-9]+$/.test(workspaceSchema)) {
  console.error('set WORKSPACE_SCHEMA to the workspace schema name');
  process.exit(1);
}

if (inputPath === undefined || prefix === undefined) {
  console.error(
    'usage: backfill-payment-titles.ts <rows.tsv> <output-prefix>',
  );
  process.exit(1);
}

const table = `${workspaceSchema}."_registrationPayment"`;

const lines = readFileSync(inputPath, 'utf8')
  // A file written by Windows tooling may start with a byte-order mark.
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0);

const up: string[] = ['BEGIN;'];
const down: string[] = ['BEGIN;'];
const preview: string[] = [];

for (const line of lines) {
  const columns = line.split('\t');

  if (columns.length !== 6) {
    throw new Error(`expected 6 columns, got ${columns.length}: ${line}`);
  }

  const [id, amountRaw, first, last, eventName, leadName] = columns;
  const amountToman = Number(amountRaw);

  if (!Number.isSafeInteger(amountToman)) {
    throw new Error(`unusable amount "${amountRaw}" for payment ${id}`);
  }

  const title = buildPaymentTitle({
    amountToman,
    personName: joinName(read(first), read(last)),
    eventName: read(eventName),
    leadName: read(leadName),
  });

  up.push(
    `UPDATE ${table} SET name = ${quote(title)} WHERE id = '${id}' AND (name IS NULL OR btrim(name) = '');`,
  );
  down.push(`UPDATE ${table} SET name = NULL WHERE id = '${id}';`);
  preview.push(`${id}\t${title}`);
}

up.push('COMMIT;');
down.push('COMMIT;');

writeFileSync(`${prefix}-up.sql`, `${up.join('\n')}\n`);
writeFileSync(`${prefix}-down.sql`, `${down.join('\n')}\n`);
writeFileSync(`${prefix}-preview.txt`, `${preview.join('\n')}\n`);

console.log(`${lines.length} payment(s) prepared`);
for (const row of preview) {
  console.log(`  ${row}`);
}
