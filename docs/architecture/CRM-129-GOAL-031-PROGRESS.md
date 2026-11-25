# CRM-129-GOAL-031 — Quotation UX completion (under Goal 023)

**Parent:** CRM-129-GOAL-023 (ACTIVE / NOT COMPLETE)  
**Branch:** `feat/crm-129-quotation`  
**Base recovery:** `a0cdbf78d0` · Dev app before this Goal: `quotation@0.1.56`  
**Gate:** `STOP_FOR_USER_UAT`  
**App target:** `quotation@0.1.57`

## Scope delivered

1. حقیقی / حقوقی labels; clear selection on type change; Person↔Company lists stay separate  
2. Customer picker: server page size 100, debounce, stale-request ignore, load-more via `afterCursor`  
3. Document currency + «نمایش مبلغ به» together; money unit removed from customer row  
4. Removed document «سیاست پیش‌فرض» UI; new lines still inherit workspace default  
5. Per-line net / tax / duty / total from Money Domain plan amounts  
6. Summary labels: مالیات / عوارض only (no policy name on document totals)  
7. One financial summary; document discount section distinct; rounding always shown  
8. RTL + responsive CSS for narrow side panels  
9. Nest: `position` aligned with `sortOrder` on line write; app atomic payload includes `sortOrder`

## Explicit non-goals

- No WS5/WS6  
- No redesign / new form  
- No DEV-APPLY-030 schema re-apply  
- No `:6080` / worker restart  
- Leave untracked `twenty-shared/src/ai/*` build artifacts alone  
