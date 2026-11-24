// CRM-129-009: one real PDF generation, asserting the bytes are a PDF (not just a payload).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Client } = require('pg');
const { requireDatabaseUrl } = require('./db-connection.cjs');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const schema = 'workspace_aemygqnvl0yhlv0fg3qwjt525';

(async () => {
  const db = new Client({
    connectionString: requireDatabaseUrl('scripts/crm129-pdf-check.cjs'),
  });
  await db.connect();
  const sealed = await db.query(
    `select r."quotationId" from "${schema}"."_quotationRevision" r
       join "${schema}"."_quotation" q on q.id = r."quotationId"
      where r."deletedAt" is null and q."deletedAt" is null
      order by r."createdAt" desc limit 1`,
  );
  const quotationId = sealed.rows[0].quotationId;
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${remote.apiKey}` },
    body: JSON.stringify({ action: 'generate-pdf', quotationId }),
  });
  const body = await response.json();
  const buffer = Buffer.from(body.pdfBase64 ?? '', 'base64');
  console.log(
    JSON.stringify({
      status: response.status,
      success: body.success,
      fileName: body.fileName,
      bytes: buffer.length,
      pdfMagic: buffer.subarray(0, 5).toString('latin1'),
      isPdf: buffer.subarray(0, 5).toString('latin1') === '%PDF-',
      quotationId,
    }),
  );
  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-closure-009.pdf'),
    buffer,
  );
  await db.end();
})();
