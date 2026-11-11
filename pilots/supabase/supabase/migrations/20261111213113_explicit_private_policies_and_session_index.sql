begin;
create index mp_attendance_session_fk on mp_private.attendance(session_id,group_id);
-- Explicit deny policies document and preserve the RPC-only access model,
-- even if somebody accidentally grants a table privilege in the future.
create policy deny_direct on mp_private.settings as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.principals as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.groups as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.athletes as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.sessions as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.attendance as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.receipts as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.audit as restrictive for all to anon,authenticated using(false) with check(false);
create policy deny_direct on mp_private.projection_outbox as restrictive for all to anon,authenticated using(false) with check(false);
commit;
