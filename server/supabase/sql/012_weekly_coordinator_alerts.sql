begin;
-- Weekly Friday 09:00 (America/Argentina/Buenos_Aires) coordinator alerts
-- for groups in Padron without attendance/semaforo records in the last 7 days.
create table mc_private.weekly_alerts(
 id uuid primary key default gen_random_uuid(),
 week_key text not null,
 activity text not null references mc_private.activities(name),
 coordinator_uid text not null references mc_private.users(uid),
 recipient_email text not null,
 missing_groups jsonb not null,
 created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','sending','sent','review','cancelled')),
 claimed_at timestamptz,
 sent_at timestamptz,
 unique(week_key,activity,coordinator_uid)
);
create index weekly_alerts_pending on mc_private.weekly_alerts(created_at,id) where status='pending';
alter table mc_private.weekly_alerts enable row level security;
create policy deny_direct on mc_private.weekly_alerts as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mc_private.weekly_alerts from public,anon,authenticated;

create or replace function mc_private.queue_weekly_alerts() returns void language plpgsql security definer set search_path='' as $$
declare
 v_ar_now timestamp;
 v_today_ar date;
 v_cutoff_ar date;
 v_week_key text;
 v_areas jsonb;
 a record;
 v_missing jsonb;
begin
 v_ar_now:=now() at time zone 'America/Argentina/Buenos_Aires';
 if extract(isodow from v_ar_now)<>5 or v_ar_now::time<time '09:00' then
  return;
 end if;
 select areas into v_areas from mc_private.settings where id and mode='ready';
 if v_areas is null then return; end if;
 v_today_ar:=v_ar_now::date;
 v_cutoff_ar:=v_today_ar-7;
 v_week_key:=to_char(v_today_ar,'YYYY-MM-DD');

 for a in
  select act.name from mc_private.activities act
  where act.enabled and v_areas ? act.name
  order by act.name
 loop
  with padron_groups as (
   select lower(btrim(r->>'categoria'))||E'\n'||lower(btrim(r->>'equipo')) as grp_key,
          min(btrim(r->>'categoria')||' · '||btrim(r->>'equipo')) as grp_label
   from mc_private.records rec,
        lateral jsonb_array_elements(rec.data->'rows') r
   where rec.activity=a.name
     and rec.data->>'kind'='padron'
     and coalesce(btrim(r->>'categoria'),'')<>''
     and coalesce(btrim(r->>'equipo'),'')<>''
   group by 1
  ),
  loaded_groups as (
   select distinct lower(btrim(r->>'categoria'))||E'\n'||lower(btrim(r->>'equipo')) as grp_key
   from mc_private.records rec,
        lateral jsonb_array_elements(rec.data->'rows') r
   where rec.activity=a.name
     and rec.data->>'kind'='asistencia'
     and coalesce(r->>'fecha','')~'^\d{4}-\d{2}-\d{2}$'
     and (r->>'fecha')::date>=v_cutoff_ar
     and coalesce(btrim(r->>'categoria'),'')<>''
     and coalesce(btrim(r->>'equipo'),'')<>''
  )
  select coalesce(jsonb_agg(p.grp_label order by p.grp_label),'[]'::jsonb)
  into v_missing
  from padron_groups p
  left join loaded_groups l using(grp_key)
  where l.grp_key is null;

  if jsonb_array_length(v_missing)>0 then
   insert into mc_private.weekly_alerts(week_key,activity,coordinator_uid,recipient_email,missing_groups)
   select v_week_key,a.name,u.uid,u.record->>'email',v_missing
   from mc_private.users u
   where u.record->>'rol'='Coordinación'
     and u.record->>'status'='activo'
     and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now())
     and u.record->'areas' ? a.name
     and coalesce(u.record->>'email','')~'^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
   on conflict(week_key,activity,coordinator_uid) do nothing;
  end if;
 end loop;
end$$;
revoke all on function mc_private.queue_weekly_alerts() from public,anon,authenticated;

create or replace function mc_private.source_tasks(p_secret text,p_result jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 c mc_private.maintenance%rowtype;
 s mc_private.settings%rowtype;
 approvals jsonb:='[]'::jsonb;
 weekly_alerts jsonb:='[]'::jsonb;
begin
 perform mc_private.source_auth(p_secret);
 select * into strict s from mc_private.settings where id;
 select * into strict c from mc_private.maintenance where id for update;
 if p_result is not null then
  if p_result->>'exportNonce'=c.export_nonce then
   update mc_private.maintenance set export_report=p_result->'export',export_ack=case when p_result#>>'{export,ok}'='true' then c.export_nonce else export_ack end where id;
  end if;
  if p_result->'backup' is not null then update mc_private.maintenance set backup_report=p_result->'backup',backup_requested=false where id;end if;
  if p_result->'approvalSent' is not null then update mc_private.access_notices set sent_at=now(),status='sent' where status='sending' and id::text in(select jsonb_array_elements_text(p_result->'approvalSent'));end if;
  if p_result->'approvalReview' is not null then update mc_private.access_notices set status='review' where status='sending' and id::text in(select jsonb_array_elements_text(p_result->'approvalReview'));end if;
  if p_result->>'approvalClaim' is not null then
   update mc_private.access_notices set status='review' where status='sending' and claimed_at<now()-interval '15 minutes';
   update mc_private.access_notices n set status='cancelled' where n.status='pending' and not exists(select 1 from mc_private.users u where u.uid=n.uid and u.record->>'status'='activo' and u.record->>'version'=n.authorization_version and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now()) and jsonb_array_length(u.record->'areas')>0);
   with candidates as (
    select n.id,u.record from mc_private.access_notices n join mc_private.users u on u.uid=n.uid
    where n.status='pending' and u.record->>'status'='activo' and u.record->>'version'=n.authorization_version
     and coalesce(u.record->>'email','')~'^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
     and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now())
     and jsonb_array_length(u.record->'areas')>0 and s.mode='ready'
    order by n.created_at,n.id limit greatest(0,least((p_result->>'approvalClaim')::integer,10)) for update of n skip locked
   ), claimed as (
    update mc_private.access_notices n set status='sending',claimed_at=now() from candidates x where n.id=x.id
    returning n.id,x.record
   ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',record->>'nombre','email',record->>'email','rol',record->>'rol','areas',record->'areas','expiresAt',record->'expiresAt')),'[]'::jsonb) into approvals from claimed;
  end if;
  if p_result->'weeklySent' is not null then update mc_private.weekly_alerts set sent_at=now(),status='sent' where status='sending' and id::text in(select jsonb_array_elements_text(p_result->'weeklySent'));end if;
  if p_result->'weeklyReview' is not null then update mc_private.weekly_alerts set status='review' where status='sending' and id::text in(select jsonb_array_elements_text(p_result->'weeklyReview'));end if;
  if p_result->>'weeklyClaim' is not null then
   perform mc_private.queue_weekly_alerts();
   update mc_private.weekly_alerts set status='review' where status='sending' and claimed_at<now()-interval '15 minutes';
   update mc_private.weekly_alerts w set status='cancelled'
   where w.status='pending'
     and not exists(
      select 1 from mc_private.users u
      where u.uid=w.coordinator_uid
        and u.record->>'rol'='Coordinación'
        and u.record->>'status'='activo'
        and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now())
        and u.record->'areas' ? w.activity
     );
   with candidates as (
    select w.id,w.activity,w.week_key,w.missing_groups,u.record
    from mc_private.weekly_alerts w join mc_private.users u on u.uid=w.coordinator_uid
    where w.status='pending'
      and u.record->>'rol'='Coordinación'
      and u.record->>'status'='activo'
      and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now())
      and u.record->'areas' ? w.activity
      and coalesce(u.record->>'email','')~'^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
      and s.mode='ready'
    order by w.created_at,w.id limit greatest(0,least((p_result->>'weeklyClaim')::integer,10)) for update of w skip locked
   ), claimed as (
    update mc_private.weekly_alerts w set status='sending',claimed_at=now(),recipient_email=x.record->>'email' from candidates x where w.id=x.id
    returning w.id,x.activity,x.week_key,x.missing_groups,x.record
   ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'activity',activity,'weekKey',week_key,'missingGroups',missing_groups,'nombre',record->>'nombre','email',record->>'email')),'[]'::jsonb) into weekly_alerts from claimed;
  end if;
  if p_result->'claim' is not null then update mc_private.notices set status='sending' where status='pending' and uid in(select jsonb_array_elements_text(p_result->'claim'));end if;
  if p_result->'review' is not null then update mc_private.notices set status='review' where uid in(select jsonb_array_elements_text(p_result->'review'));end if;
  if p_result->'sent' is not null then update mc_private.notices set sent_at=now(),status='sent' where uid in(select jsonb_array_elements_text(p_result->'sent'));end if;
 end if;
 return jsonb_build_object('approvals',approvals,'weeklyAlerts',weekly_alerts,'freeze',c.freeze_source,'exportNonce',c.export_nonce,'exportAck',c.export_ack,'mode',s.mode,'ownerEmail',(select record->>'email' from mc_private.users where uid=s.owner_uid),'notices',coalesce((select jsonb_agg(jsonb_build_object('uid',n.uid,'nombre',u.record->>'nombre','email',u.record->>'email')) from mc_private.notices n join mc_private.users u using(uid) where n.sent_at is null and n.status='pending'),'[]'::jsonb),'backupRequested',(select backup_requested from mc_private.maintenance where id),'backup',coalesce((select backup_report from mc_private.maintenance where id),'null'::jsonb));
end$$;
commit;
