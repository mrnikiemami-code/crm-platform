-- Rows for the payment-title repair: every payment whose stored title is empty.
-- Read-only. Feed the output to scripts/backfill-payment-titles.ts, which turns
-- it into an up/down SQL pair. Nothing is written here.
--
-- Replace the schema below if the workspace schema differs.
\pset pager off
\pset format unaligned
\pset fieldsep '\t'
\pset tuples_only on

select rp.id,
       rp."amountToman"::text,
       coalesce(nullif(btrim(p."nameFirstName"), ''), '\N'),
       coalesce(nullif(btrim(p."nameLastName"), ''), '\N'),
       coalesce(nullif(btrim(ae."name"), ''), '\N'),
       coalesce(nullif(btrim(er."name"), ''), '\N')
from workspace_aemygqnvl0yhlv0fg3qwjt525."_registrationPayment" rp
left join workspace_aemygqnvl0yhlv0fg3qwjt525."_eventRegistration" er
  on er.id = rp."eventRegistrationId" and er."deletedAt" is null
left join workspace_aemygqnvl0yhlv0fg3qwjt525.person p
  on p.id = er."personId" and p."deletedAt" is null
left join workspace_aemygqnvl0yhlv0fg3qwjt525."_academyEvent" ae
  on ae.id = er."academyEventId" and ae."deletedAt" is null
where rp."deletedAt" is null
  and (rp.name is null or btrim(rp.name) = '')
order by rp."createdAt";
