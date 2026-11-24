// One place that resolves the staff-only Postgres connection used by the verification
// scripts. The credential is never stored in this repository: it comes from the
// environment, and a missing one stops the script with an explanation instead of a
// guess. Nothing here prints the value it returns.
const MISSING_SECRET_EXIT_CODE = 2;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const firstDefined = (...values) => {
  for (const value of values) {
    const text = trim(value);

    if (text !== '') {
      return text;
    }
  }

  return '';
};

// A full URL wins because it carries its own host, port, user and database. Otherwise
// the discrete PG* / CRM129_* variables are composed, so a shell that already exports
// PGPASSWORD needs no extra setup.
const resolveDatabaseUrl = () => {
  const url = firstDefined(process.env.CRM129_DATABASE_URL);

  if (url !== '') {
    return url;
  }

  const password = firstDefined(
    process.env.CRM129_DB_PASSWORD,
    process.env.PGPASSWORD,
  );

  if (password === '') {
    return null;
  }

  const host = firstDefined(process.env.CRM129_DB_HOST, process.env.PGHOST) || '127.0.0.1';
  const port = firstDefined(process.env.CRM129_DB_PORT, process.env.PGPORT) || '5432';
  const user = firstDefined(process.env.CRM129_DB_USER, process.env.PGUSER) || 'postgres';
  const database =
    firstDefined(process.env.CRM129_DB_NAME, process.env.PGDATABASE) || 'default';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

// Refuses to run without a credential, and says so without echoing anything secret.
const requireDatabaseUrl = (scriptName = 'this script') => {
  const url = resolveDatabaseUrl();

  if (url === null) {
    console.error(
      `[${scriptName}] no database credential available. Export CRM129_DATABASE_URL ` +
        '(or CRM129_DB_PASSWORD / PGPASSWORD) for a staff database and rerun. The ' +
        'credential is deliberately not stored in the repository.',
    );
    process.exit(MISSING_SECRET_EXIT_CODE);
  }

  return url;
};

module.exports = { MISSING_SECRET_EXIT_CODE, requireDatabaseUrl, resolveDatabaseUrl };
