const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const token = remote.apiKey;
const label = process.argv[2] || 'bench';

const post = async (route, body) => {
  const started = Date.now();
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const elapsedMs = Date.now() - started;
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text };
  }
  return { httpStatus: response.status, elapsedMs, data };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const runs = [];

  for (let i = 0; i < 3; i += 1) {
    const open = await post('/quotation/search-catalog-items', {
      search: '',
      pageSize: 100,
    });
    if (open.data?.success !== true) {
      throw new Error(`open failed: ${JSON.stringify(open.data)}`);
    }

    const page2 = open.data.hasNextPage
      ? await post('/quotation/search-catalog-items', {
          search: '',
          afterCursor: open.data.endCursor,
          pageSize: 100,
        })
      : { elapsedMs: null, data: { items: [] } };

    const deepSku =
      (page2.data?.items ?? []).find((row) =>
        String(row.sku || row.name || '').includes('DEEP'),
      )?.sku ||
      (open.data.items ?? []).find((row) =>
        String(row.sku || '').includes('104'),
      )?.sku ||
      'R9CAT';

    const search = await post('/quotation/search-catalog-items', {
      search: deepSku.slice(0, Math.min(deepSku.length, 18)),
      pageSize: 100,
    });

    runs.push({
      openMs: open.elapsedMs,
      openCount: open.data.items?.length ?? 0,
      openTimings: open.data.timings ?? null,
      page2Ms: page2.elapsedMs,
      page2Count: page2.data?.items?.length ?? 0,
      page2Timings: page2.data?.timings ?? null,
      searchMs: search.elapsedMs,
      searchCount: search.data?.items?.length ?? 0,
      searchTimings: search.data?.timings ?? null,
    });

    await sleep(400);
  }

  const avg = (key) =>
    Math.round(
      runs.reduce((sum, row) => sum + (row[key] ?? 0), 0) / runs.length,
    );

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R11_CATALOG_BENCH',
        label,
        runs,
        averagesMs: {
          open: avg('openMs'),
          page2: avg('page2Ms'),
          search: avg('searchMs'),
        },
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R11_CATALOG_BENCH_FAIL', error);
  process.exit(1);
});
