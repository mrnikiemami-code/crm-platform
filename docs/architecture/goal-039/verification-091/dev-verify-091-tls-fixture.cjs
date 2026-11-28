// Verification-only isolated TLS fixture. Mirrors production Asan read transport TLS options
// (SNI + checkServerIdentity + rejectUnauthorized) against a local ephemeral HTTPS server.
// Does NOT weaken product destination policy and does NOT contact public IPs.
const https = require('node:https');
const tls = require('node:tls');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');

const evidenceDir = __dirname;
const hostname = 'fixture.asan-g039.local';

const makeCert = () => {
  // Prefer @peculiar or openssl if available; fall back to Node selfsigned via crypto
  // Minimal self-signed for localhost fixture using openssl if present.
  const keyPath = path.join(evidenceDir, 'tls-fixture-key.pem');
  const certPath = path.join(evidenceDir, 'tls-fixture-cert.pem');
  const { spawnSync } = require('node:child_process');
  const gen = spawnSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath, '-out', certPath, '-days', '1',
      '-subj', `/CN=${hostname}`,
      '-addext', `subjectAltName=DNS:${hostname}`,
    ],
    { encoding: 'utf8' },
  );
  if (gen.status !== 0) {
    return { ok: false, reason: 'openssl unavailable or failed', detail: (gen.stderr || gen.stdout || '').slice(0, 500) };
  }
  return {
    ok: true,
    key: fs.readFileSync(keyPath, 'utf8'),
    cert: fs.readFileSync(certPath, 'utf8'),
    keyPath,
    certPath,
  };
};

const requestOnce = ({ port, servername, ca, rejectUnauthorized }) =>
  new Promise((resolve) => {
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port,
        servername,
        method: 'GET',
        path: '/ProductsNew/LastProducts?Count=1',
        rejectUnauthorized,
        ca,
        checkServerIdentity: (_name, cert) => tls.checkServerIdentity(servername, cert),
        agent: false,
        headers: { Host: `${servername}:${port}`, 'Accept-Encoding': 'identity' },
        timeout: 3000,
      },
      (res) => {
        res.resume();
        resolve({ ok: true, status: res.statusCode ?? 0 });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, error: String(error.message || error) });
    });
    req.end();
  });

(async () => {
  const results = { hostname, cases: {} };
  const material = makeCert();
  if (!material.ok) {
    results.status = 'BLOCKED';
    results.reason = material.reason;
    results.detail = material.detail;
    fs.writeFileSync(path.join(evidenceDir, 'tls-fixture-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    process.exit(2);
  }

  const server = https.createServer(
    { key: material.key, cert: material.cert },
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const trusted = await requestOnce({
    port,
    servername: hostname,
    ca: material.cert,
    rejectUnauthorized: true,
  });
  results.cases.trustedFixtureCert = trusted.ok && trusted.status === 200 ? 'PASS' : `FAIL:${JSON.stringify(trusted)}`;

  const badName = await requestOnce({
    port,
    servername: 'wrong-host.example',
    ca: material.cert,
    rejectUnauthorized: true,
  });
  results.cases.badSniRejected =
    !badName.ok && /Hostname\/IP does not match|altnames|ENOTFOUND|certificate/i.test(badName.error || '')
      ? 'PASS'
      : `FAIL:${JSON.stringify(badName)}`;

  const untrusted = await requestOnce({
    port,
    servername: hostname,
    ca: undefined,
    rejectUnauthorized: true,
  });
  results.cases.untrustedRejected =
    !untrusted.ok && /self-signed|UNABLE_TO_VERIFY|certificate/i.test(untrusted.error || '')
      ? 'PASS'
      : `FAIL:${JSON.stringify(untrusted)}`;

  // Redirect/mutation policy covered by unit tests; record linkage.
  results.cases.productPolicyAllowlist = 'COVERED_BY_UNIT:asan-approved-transport.test.ts';
  results.cases.publicIpPinE2E =
    'NOT_RUN: production policy rejects private IPs; no isolated public-IP namespace available without contacting external hosts';

  server.close();
  try { fs.unlinkSync(material.keyPath); } catch {}
  try { fs.unlinkSync(material.certPath); } catch {}

  const failed = Object.values(results.cases).some((v) => String(v).startsWith('FAIL'));
  results.status = failed ? 'FAIL' : 'PASS_SCOPED';
  fs.writeFileSync(path.join(evidenceDir, 'tls-fixture-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error) }));
  process.exit(1);
});
