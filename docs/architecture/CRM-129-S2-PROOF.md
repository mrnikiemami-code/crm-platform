# CRM-129-S2 — Catalog + quotation UX (local)

**Base:** `d544cc83dd` · **Status:** code ready, **not installed** · PDF browser ZWNJ remains PARTIAL and non-blocking.

## Implemented (in source)

- Persian labels on `catalogItem`, `quotation`, `quotationLine`
- Line `kind` snapshot (`PRODUCT`|`SERVICE`)
- Domain: `draft-quotation`, `catalog-upsert`, save service + write payloads
- Role without accounting objects
- Views: همهٔ کالا و خدمات / همهٔ پیش‌فاکتورها
- Front components: quotation draft form, catalog item form (RTL, تومان/ریال)
- Command menu: پیش‌فاکتور از شخص/شرکت، کالای جدید
- Logic routes (validate + payload; persistence gated):  
  `POST /quotation/save-draft`, `POST /quotation/save-catalog-item`

## Still needs install / wiring

- App install on Dev (creates objects, views, commands)
- GraphQL persistence after sync (routes return `PERSISTENCE_NOT_WIRED` / `APP_NOT_INSTALLED`)
- Live Asan (S3/S4) — not in S2
- Intranet / push / worker restart — forbidden here

## PDF note

Browser copy of ZWNJ still stripped by pdf.js; MuPDF OK. Tracked separately; does not block these pages.
