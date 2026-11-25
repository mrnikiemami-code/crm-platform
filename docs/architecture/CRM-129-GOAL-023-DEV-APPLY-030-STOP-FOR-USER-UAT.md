# CRM-129-GOAL-023-DEV-APPLY-030 — STOP_FOR_USER_UAT

**Gate:** `STOP_FOR_USER_UAT`  
**Goal 023:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Recovery (pre-apply):** `23698e4ae7`  
**Installed app:** `quotation@0.1.56`  
**Dev target:** `http://localhost:3002` (twenty-server-1) — **not** `:6080`

---

## Real form URL (Dev)

| What | URL |
|---|---|
| New quotation from Person | Open any Person → **ایجاد پیش‌فاکتور** (side panel form) |
| Saved UAT draft | http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729 |
| Quotations list | http://localhost:3002/objects/quotations |
| Tax settings | sidebar → مالیات و عوارض |
| Currency settings | sidebar → تنظیمات حسابداری |

**UAT draft title:** `UAT-APPLY-030 تست فرم واقعی`  
**Customer:** محمد طهماسب (Person) — safe test overlay; no production purge

---

## Preflight (passed)

- Branch `feat/crm-129-quotation`, recovery `23698e4ae7`
- Dev only (`dev-crm129` / :3002); intranet `:6080` StartedAt unchanged (`2026-11-19…`), health 200 on `192.168.4.85:6080`
- Worker StartedAt unchanged (not restarted for apply)
- Backup: `D:\CrmDeployment\backups\crm129-dev-apply-030\pre-apply-20261125-172646.dump` + `RESTORE.md`
- Schema diff additive (WS1–WS4 fields); no outbound enablement

---

## Apply + bootstrap

| Step | Result |
|---|---|
| Schema WS1–WS4 on Dev | Applied with `quotation@0.1.56` |
| App version in `core.application` | `پیش‌فاکتور` **0.1.56** |
| Currency bootstrap | IRR created once (`isDefault=true`); list = IRR only |
| Tax bootstrap | Idempotent — «سیاست پایه از قبل وجود دارد»; default `IR_VAT_9` |
| Nest quotation module | Deployed; server-only restart |
| Backend health | `:3002/healthz` → 200 |

---

## IRR phase-1 repair (source + runtime)

- `selectInitialDocumentCurrencyCode` always returns IRR while `MULTI_CURRENCY_DOCUMENTS=false` (even empty/USD catalog)
- Form currency `<select>` options: **IRR only**
- Vitest `document-currency.test.ts`: **9 PASS**

---

## Browser UAT results (`localhost:3002`)

| Scenario | Result |
|---|---|
| Create from Person | PASS — side panel form |
| Document currency IRR at top | PASS — only option `ریال ایران (IRR) — پیش‌فرض` |
| Two lines, two tax policies | PASS — line1 `IR_VAT_9` (6%+3%), line2 `TAX_1000` (6%+4%); DB sealed |
| New line inherits default policy | PASS — after setting default to `TAX_1050`, new line opened as `TAX_1050` |
| Change policy on one line only | PASS — line2 → `TAX_1000`; line1 stayed `IR_VAT_9` |
| Line + document discount + totals | PASS — line 10%, doc 5%; final **۱۹۷٬۶۹۶ تومان** |
| Save + reopen unchanged | PASS — same title, prices, discounts, policies, IRR |
| PDF | PASS — «دانلود PDF فارسی» invoked; **version stayed 1** (no unwanted revision) |
| Accounting codes hidden on form | PASS — `کد حسابداری` not in form section (person record field only) |
| Existing RTL / design chrome | PASS — same product panel, Persian RTL |

**Evidence screenshots:**  
`D:\CrmDeployment\backups\crm129-dev-apply-030\evidence\`  
(`01-new-form-irr.png`, `02-form-lines-section.png`, `03-reopen-saved-quote.png`)

---

## Remaining issues (non-blocking for this gate)

1. **Summary tax labels** often follow the document default policy name even when lines use mixed policies; **amounts** still match per-line sealed rates (verified against mixed 9%/10% expectation). Cosmetic/label honesty for mixed-tax summary can wait for a later polish pack — **not WS5/WS6 now**.
2. Both saved lines show `position = 0` in DB (ordering quirk); UI still shows ردیف 1 / ردیف 2 correctly.

---

## Explicit stop

**Do not start WS5 / WS6 / new design / further Apply until the user confirms appearance and behavior of this real Dev form.**

Goal 023 = **ACTIVE / NOT COMPLETE**
