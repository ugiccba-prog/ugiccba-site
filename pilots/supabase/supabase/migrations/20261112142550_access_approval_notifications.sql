begin;
-- Future approval transitions only. Existing users are never backfilled.
create table mc_private.access_notices(
 id uuid primary key default gen_random_uuid(),uid text not null references mc_private.users(uid),
 authorization_version text not null,created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','sending','sent','review','cancelled')),
 claimed_at timestamptz,sent_at timestamptz
);
create index access_notices_pending on mc_private.access_notices(created_at,id) where status='pending';
create index access_notices_user on mc_private.access_notices(uid);
alter table mc_private.access_notices enable row level security;
create policy deny_direct on mc_private.access_notices as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mc_private.access_notices from public,anon,authenticated;
create function mc_private.queue_access_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare enabled boolean;previously_enabled boolean;
begin
 if new.uid=(select owner_uid from mc_private.settings where id) then return new;end if;
 enabled:=coalesce(new.record->>'status'='activo' and (new.record->>'expiresAt' is null or (new.record->>'expiresAt')::timestamptz>now()) and jsonb_array_length(new.record->'areas')>0,false);
 previously_enabled:=coalesce(old.record->>'status'='activo' and (old.record->>'expiresAt' is null or (old.record->>'expiresAt')::timestamptz>now()) and jsonb_array_length(old.record->'areas')>0,false);
 if not enabled then
  update mc_private.access_notices set status='cancelled' where uid=new.uid and status='pending';
 elsif not previously_enabled then
  insert into mc_private.access_notices(uid,authorization_version)values(new.uid,new.record->>'version');
 else
  update mc_private.access_notices set authorization_version=new.record->>'version' where uid=new.uid and status='pending';
 end if;
 return new;
end$$;
revoke all on function mc_private.queue_access_notice() from public,anon,authenticated;
create trigger access_approved after update of record on mc_private.users for each row execute function mc_private.queue_access_notice();
create or replace function mc_private.source_tasks(p_secret text,p_result jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.maintenance%rowtype;s mc_private.settings%rowtype;approvals jsonb:='[]'::jsonb;begin
 perform mc_private.source_auth(p_secret);select * into strict s from mc_private.settings where id;
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
  if p_result->'claim' is not null then update mc_private.notices set status='sending' where status='pending' and uid in(select jsonb_array_elements_text(p_result->'claim'));end if;
  if p_result->'review' is not null then update mc_private.notices set status='review' where uid in(select jsonb_array_elements_text(p_result->'review'));end if;
  if p_result->'sent' is not null then update mc_private.notices set sent_at=now(),status='sent' where uid in(select jsonb_array_elements_text(p_result->'sent'));end if;
 end if;
 return jsonb_build_object('approvals',approvals,'freeze',c.freeze_source,'exportNonce',c.export_nonce,'exportAck',c.export_ack,'mode',s.mode,'ownerEmail',(select record->>'email' from mc_private.users where uid=s.owner_uid),'notices',coalesce((select jsonb_agg(jsonb_build_object('uid',n.uid,'nombre',u.record->>'nombre','email',u.record->>'email')) from mc_private.notices n join mc_private.users u using(uid) where n.sent_at is null and n.status='pending'),'[]'::jsonb),'backupRequested',(select backup_requested from mc_private.maintenance where id),'backup',coalesce((select backup_report from mc_private.maintenance where id),'null'::jsonb));
end$$;

-- Existing public INVOKER wrapper and source credential gate remain unchanged.
commit;
