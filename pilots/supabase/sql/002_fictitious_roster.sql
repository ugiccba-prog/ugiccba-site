-- NEW PILOT PROJECT ONLY. 25 fictitious activities, 75 groups, 1500 athletes.
-- No identities, authorizations or data are imported from the active app.
begin;
do $$begin
  if exists(select 1 from mp_private.groups) then raise exception 'Seed requires an empty pilot.'; end if;
end$$;
insert into mp_private.groups(id,activity,label)
select md5('pilot-group-'||n)::uuid,
  case when (n-1)/3=24 then 'Colonia' else 'Actividad ficticia '||lpad((((n-1)/3)+1)::text,2,'0') end,
  'Grupo ficticio '||lpad(n::text,2,'0') from generate_series(1,75) n;
insert into mp_private.athletes(id,group_id,name)
select md5('pilot-athlete-'||n)::uuid,md5('pilot-group-'||(((n-1)/20)+1))::uuid,
  'Participante ficticio '||lpad(n::text,4,'0') from generate_series(1,1500) n;
insert into mp_private.principals(subject,name,role,status,activities)
values('pilot-teacher','Profe ficticio','Profe','activo',array['Actividad ficticia 01']),
 ('pilot-reader','Consulta ficticia','Consulta','activo',array['Actividad ficticia 01']),
 ('pilot-pending','Solicitud ficticia','Profe','pendiente',array['Actividad ficticia 01']);
-- These are test subjects, not actual Firebase accounts. A real pilot UID must
-- be granted separately by an administrator; never approve from browser input.
commit;
