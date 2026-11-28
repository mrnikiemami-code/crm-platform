# Goal 039 — User UAT checklist (offline / Dev only)

Version under test: quotation@0.1.91  
Source SHA: `14ff9f4006442506cff6e399c0861d300b16419c`  
Workspace: 4d (`afc7afb6-94ef-4142-872b-52a81b3e91dd`)

**Rules:** No live Asan. No real customer messages. No Intranet :6080. Visual acceptance is user-only.

## Security / settings
- [ ] Confirm installed app version shows 0.1.91 in Dev
- [ ] Accounting settings overview shows connections / items / customers without jargon redesign
- [ ] Tax/currency defaults remain IRR + existing policies; refuse activating multi-currency if prompted
- [ ] Dev admin: rotate historical fixture passwords / revoke disposable API keys (Cursor blocked)

## Accounting (Mock only)
- [ ] Open کالاها / مشتریان native tables; search and page
- [ ] Select rows across pages; confirm unmapped/stale messaging is honest
- [ ] Preview accounting export from an approved/ready quotation on Mock connection only
- [ ] Confirm no claim of live Asan submission

## Quotation lifecycle
- [ ] Create quotation from Person via canonical create
- [ ] Create quotation from Company via canonical create
- [ ] Add lines; percent + fixed discounts; independent tax/duty; totals look correct in IRR
- [ ] Save/edit; confirm stale version is refused
- [ ] Walk DRAFT → PENDING_INTERNAL_APPROVAL → READY_TO_SEND → SENT
- [ ] Confirm unsupported reverse transition is refused
- [ ] Attempt PDF download — **expect FAIL until DEFECT-PDF-FONT fixed**

## Communication
- [ ] Share text for manual channels (WhatsApp/Telegram/…) copies Persian text; no false “sent”
- [ ] Create customer link; open once; revoke; confirm revoked/draft denial
- [ ] Communications list remains truthful (empty or fixture-only); no real outbound

## UI / RTL
- [ ] Desktop RTL quotations list usable
- [ ] Mobile viewport (~390px) quotations list usable
- [ ] No unwanted redesign / duplicate forms / unauthorized code entry fields

## Sign-off
- [ ] User visual acceptance
- [ ] Architect accepts offline scope (Goal 023 remains ACTIVE for real accounting release)
