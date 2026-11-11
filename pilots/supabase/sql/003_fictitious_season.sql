-- Optional CAPACITY fixture, separate from migration and initial roster.
-- 40 weeks x 2 classes x 75 groups = 6000 sessions / 120000 attendance rows.
begin;
do $$begin if exists(select 1 from mp_private.sessions) then raise exception 'Season fixture requires no sessions.'; end if;end$$;
insert into mp_private.sessions(id,group_id,day,season,revision)
select md5(g.id::text||'-class-'||n)::uuid,g.id,date '2026-01-05'+(n/2)*7+(n%2)*3,1,1
from mp_private.groups g cross join generate_series(0,79) n;
insert into mp_private.attendance(session_id,group_id,athlete_id,state,semaphore,food)
select s.id,s.group_id,a.id,case when substr(a.id::text,1,1)='a' then 'A' else 'P' end,'N',false
from mp_private.sessions s join mp_private.athletes a on a.group_id=s.group_id;
insert into mp_private.receipts(request_id,actor,payload,result,created_at)
select s.id,'pilot-teacher',jsonb_build_object('fixture',true,'session',s.id),
jsonb_build_object('ok',true,'request_id',s.id,'revision',1),s.day::timestamptz from mp_private.sessions s;
insert into mp_private.audit(request_id,session_id,actor,before_data,after_data,created_at)
select s.id,s.id,'pilot-teacher',jsonb_build_object('rows',rows.data),jsonb_build_object('rows',rows.data),s.day::timestamptz
from mp_private.sessions s cross join lateral(
  select jsonb_agg(jsonb_build_object('id',a.athlete_id,'state',a.state,'semaphore',a.semaphore,'food',a.food) order by a.athlete_id) data
  from mp_private.attendance a where a.session_id=s.id
) rows;
-- Synthetic historical receipt/audit bodies, not 6000 exercised API writes.
-- No outbox jobs: this fixture must never flood Sheets with historical test data.
commit;
