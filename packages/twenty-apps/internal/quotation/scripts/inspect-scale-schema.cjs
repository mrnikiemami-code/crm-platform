const { Client } = require('pg');

const connectionString =
  process.env.PG_DATABASE_URL ||
  'postgres://postgres:563162150m8084M@localhost:5432/default';

(async () => {
  const client = new Client({ connectionString });
  await client.connect();

  const schemas = await client.query(
    "select schema_name from information_schema.schemata where schema_name like 'workspace_%' order by 1",
  );
  console.log('workspace schemas:', schemas.rows.map((row) => row.schema_name).join(', '));

  for (const { schema_name: schema } of schemas.rows) {
    const indexes = await client.query(
      `select tablename, indexdef from pg_indexes where schemaname = $1 and tablename in ('person','company','catalogItem') order by tablename, indexname`,
      [schema],
    );
    console.log(`--- ${schema}`);
    for (const row of indexes.rows) console.log(row.indexdef);
  }

  await client.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
