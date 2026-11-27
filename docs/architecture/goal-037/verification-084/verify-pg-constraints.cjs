// Prove real PG NOT NULL + UNIQUE for tokenHash/scopeKey. No schema patches.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspaceId = process.argv[2];
const label = process.argv[3] || 'workspace';
if (!workspaceId) {
  console.error('Usage: node verify-pg-constraints.cjs <workspaceId> [label]');
  process.exit(1);
}

const schemaQuery = `
SELECT "databaseSchema" FROM core."workspace" WHERE id = '${workspaceId}';
`;
const schemaResult = spawnSync(
  'docker',
  ['exec', '-i', 'twenty-db-1', 'psql', '-U', 'postgres', '-d', 'default', '-t', '-A', '-c', schemaQuery],
  { encoding: 'utf8' },
);
const schema = schemaResult.stdout.trim();
if (!schema) {
  console.error('No schema for workspace', workspaceId, schemaResult.stderr);
  process.exit(1);
}

const sql = `
WITH cols AS (
  SELECT c.table_name, c.column_name, c.is_nullable, c.column_default, c.data_type
  FROM information_schema.columns c
  WHERE c.table_schema = '${schema}'
    AND (
      (c.table_name ILIKE '%quotationCustomerLink%' AND c.column_name = 'tokenHash')
      OR (c.table_name ILIKE '%quotation_customer_link%' AND c.column_name = 'tokenHash')
      OR (c.table_name ILIKE '%quotationSequence%' AND c.column_name = 'scopeKey')
      OR (c.table_name ILIKE '%quotation_sequence%' AND c.column_name = 'scopeKey')
      OR (c.column_name IN ('tokenHash','scopeKey') AND c.table_name ILIKE '%quotation%')
    )
)
SELECT json_agg(cols) FROM cols;
`;

const cols = spawnSync(
  'docker',
  ['exec', '-i', 'twenty-db-1', 'psql', '-U', 'postgres', '-d', 'default', '-t', '-A', '-c', sql],
  { encoding: 'utf8' },
);

const indexSql = `
SELECT json_agg(row_to_json(t)) FROM (
  SELECT i.relname AS index_name, t.relname AS table_name, a.attname AS column_name, ix.indisunique, ix.indisprimary
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname = '${schema}'
    AND a.attname IN ('tokenHash','scopeKey')
    AND t.relname ILIKE '%quotation%'
) t;
`;
const indexes = spawnSync(
  'docker',
  ['exec', '-i', 'twenty-db-1', 'psql', '-U', 'postgres', '-d', 'default', '-t', '-A', '-c', indexSql],
  { encoding: 'utf8' },
);

const out = {
  label,
  workspaceId,
  schema,
  columns: cols.stdout.trim() ? JSON.parse(cols.stdout.trim() || 'null') : null,
  indexes: indexes.stdout.trim() ? JSON.parse(indexes.stdout.trim() || 'null') : null,
  columnQueryError: cols.stderr || null,
  indexQueryError: indexes.stderr || null,
};

const evidence = path.join(__dirname, `pg-constraints-${label}.json`);
fs.writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
