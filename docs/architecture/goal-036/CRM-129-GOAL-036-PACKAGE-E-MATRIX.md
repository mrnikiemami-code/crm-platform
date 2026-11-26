# CRM-129-GOAL-036 — Package E integrated verification matrix

**Gate:** `STOP_FOR_ARCHITECT_AND_USER_UAT`  
**App on Dev:** `quotation@0.1.69` (pending sync if not yet applied)  
**Branch:** `feat/crm-129-quotation`  
**Goal 023:** ACTIVE / NOT COMPLETE

## Commits

| Pack | SHA (short) | Version |
| --- | --- | --- |
| A | `cab53037` | 0.1.66 |
| B / WS5 | `09c8c5b3` | 0.1.67 |
| C / WS6 | `33ced3c9` | 0.1.68 |
| D / WS7-B | (this pack) | 0.1.69 |

## Automated regression (this session)

| Area | Suite | Result |
| --- | --- | --- |
| UI financial settings | `tax-policy-settings-panel.test.tsx` | **32 PASS** |
| Accounting connections | `accounting-connections-section.test.tsx` | **46 PASS** |
| Accounting panel | `accounting-settings-panel.test.tsx` | **8 PASS** |
| Financial contract | `financial-contract.test.ts` | run in E batch |
| Tax code contract | `tax-code-contract.test.ts` | run in E batch |

## Browser (Package A)

| Check | Result |
| --- | --- |
| Edit button present; row click no dialog | PASS |
| More menu ≠ edit dialog | PASS |
| Edit opens dialog; locked accounting code Persian hint | PASS |
| Screenshots | `goal-036/pkg-a-*.png` |

## Matrix status (honest)

| Domain | PASS | Notes |
| --- | --- | --- |
| Financial integrity (Money/snapshot/IRR) | PRIOR + no regress in this task | No Money Domain edits |
| Authorization / workspace | PRIOR Nest authority | Not re-proved end-to-end this session |
| Accounting mapping ownership | PASS technical | WS5 tests + no purge |
| Capability Mock/Asan UI | PASS technical | WS6 tests |
| UI responsive 320–1440 | PARTIAL | Mobile CSS present; full width matrix not re-logged |
| Outbound / Asan live | PASS (still off) | No vendor calls introduced |
| Retire/inflight / credential rotation | OPEN RISK | Prior architect notes; not closed by GOAL-036 |

## Open for architect + user UAT

1. Visual accept of financial settings `@0.1.69` vs rejected 033/034/034-R2 criteria  
2. Accounting settings mapping UX (catalog picker + orphans)  
3. WS7-B PENDING_USER_DESIGN_APPROVAL surfaces  
4. Full E2E quotation create → preview on live Dev with Persian operator walkthrough  

**Do not mark Goal 023 complete until Success Criteria + user accept.**
