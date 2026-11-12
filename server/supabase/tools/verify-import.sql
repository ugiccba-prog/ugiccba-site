-- Read-only verification. No user records, permissions or flags are modified.
do $$
#variable_conflict use_variable
declare
 c mc_private.settings%rowtype;
 m mc_private.maintenance%rowtype;
 g jsonb;
 j jsonb;
 unit record;
 a mc_private.activities%rowtype;
 kind text;
 expected jsonb;
 actual jsonb;
begin
 select * into strict c from mc_private.settings where id;
 select * into strict m from mc_private.maintenance where id;
 if c.mode<>'preparing' then raise exception 'La base no está en preparación; revisar antes de otro corte.';end if;
 if not m.freeze_source or m.export_nonce is null or m.export_ack is distinct from m.export_nonce or m.export_report->>'ok' is distinct from 'true' then raise exception 'Falta una exportación verificada del origen cerrado.';end if;
 if m.backup_report->>'ok' is distinct from 'true' or coalesce(m.backup_report->>'sha256','')!~'^[0-9a-f]{64}$' then raise exception 'Falta el respaldo verificado.';end if;
 if exists(select 1 from mc_private.outbox) or exists(select 1 from mc_private.activities where projected_version<>version) then raise exception 'Hay copias de Sheets pendientes.';end if;
 if (select count(distinct p.unit) from mc_private.import_parts p)<>jsonb_array_length(m.export_report#>'{manifest,units}') then raise exception 'La cantidad de unidades no coincide con el manifiesto cerrado.';end if;
 for unit in select p.unit,count(*) as received,min(total) as parts,max(total) as maxparts,min(checksum) as checksum,max(checksum) as maxsum,string_agg(body,'' order by part) as body from mc_private.import_parts p group by p.unit loop
  if unit.received<>unit.parts or unit.parts<>unit.maxparts or unit.checksum<>unit.maxsum or encode(sha256(convert_to(unit.body,'UTF8')),'hex')<>unit.checksum then raise exception 'Una unidad está incompleta o cambió su huella.';end if;
  if not exists(select 1 from jsonb_array_elements(m.export_report#>'{manifest,units}')x where x->>'unit'=unit.unit and x->>'checksum'=unit.checksum and (x->>'parts')::integer=unit.parts) then raise exception 'Una unidad no coincide con el manifiesto cerrado.';end if;
 end loop;
 select string_agg(p.body,'' order by p.part)::jsonb into g from mc_private.import_parts p where p.unit='global';
 if g is null or g#>>'{config,owner}' is distinct from c.owner_uid or g#>>'{config,project}' is distinct from c.firebase_project or g#>>'{config,idSecret}' is distinct from c.id_secret or g#>'{config,areas}' is distinct from c.areas then raise exception 'La configuración o las actividades no coinciden.';end if;
 expected:=(select coalesce(jsonb_object_agg(x->>'uid',x),'{}'::jsonb) from jsonb_array_elements(g#>'{users,users}')x);
 actual:=(select coalesce(jsonb_object_agg(uid,record),'{}'::jsonb) from mc_private.users);
 if actual is distinct from expected then raise exception 'Los usuarios o sus permisos no coinciden exactamente.';end if;
 actual:=(select coalesce(jsonb_object_agg(id,event),'{}'::jsonb) from mc_private.permission_history);
 if actual is distinct from g#>'{users,history}' then raise exception 'El historial de permisos no coincide.';end if;
 expected:=(select coalesce(jsonb_agg(x order by x::text),'[]'::jsonb) from jsonb_array_elements(g->'identities')x);
 actual:=(select coalesce(jsonb_agg(jsonb_build_array(fingerprint,id,status) order by jsonb_build_array(fingerprint,id,status)::text),'[]'::jsonb) from mc_private.identities);
 if actual is distinct from expected then raise exception 'Las identidades estables no coinciden.';end if;
 if (select count(*) from mc_private.activities)<>jsonb_array_length(c.areas) or exists(select 1 from mc_private.activities where not(c.areas?name)) then raise exception 'Las actividades de destino no coinciden con el origen.';end if;
 for unit in select p.unit,string_agg(body,'' order by part)::jsonb as data from mc_private.import_parts p where p.unit<>'global' group by p.unit loop
  j:=unit.data;
  select * into strict a from mc_private.activities where name=unit.unit;
  if j->>'name' is distinct from a.name or (j#>>'{meta,temporada}')::integer<>a.epoch or (j#>>'{meta,version}')::bigint<>a.version then raise exception 'La temporada o versión de una actividad no coincide.';end if;
  foreach kind in array array['padron','asistencia','evaluaciones','sesiones'] loop
   expected:=(select coalesce(jsonb_agg(x order by x::text),'[]'::jsonb) from jsonb_array_elements(j#>array['state',kind])x);
   actual:=(select coalesce(jsonb_agg(x order by x::text),'[]'::jsonb) from mc_private.records r cross join lateral jsonb_array_elements(r.data->'rows')x where r.activity=unit.unit and r.kind=kind);
   if actual is distinct from expected then raise exception 'Los registros de una actividad no coinciden.';end if;
  end loop;
  actual:=(select coalesce(jsonb_object_agg(id,value),'{}'::jsonb) from mc_private.fichas where activity=unit.unit);
  if actual is distinct from j#>'{state,fichas}' then raise exception 'Las fichas no coinciden.';end if;
  actual:=(select r.data-'kind' from mc_private.records r where r.activity=unit.unit and r.kind='config');
  if actual is distinct from jsonb_build_object('gestos',j#>'{state,gestos}','email',j#>'{state,email}') then raise exception 'La configuración de la actividad no coincide.';end if;
  actual:=(select coalesce(jsonb_object_agg(key,revision),'{}'::jsonb) from mc_private.versions where activity=unit.unit);
  if actual is distinct from j->'versions' then raise exception 'Las revisiones no coinciden.';end if;
  actual:=(select coalesce(jsonb_object_agg(id,event),'{}'::jsonb) from mc_private.audit where activity=unit.unit);
  if actual is distinct from j->'audit' then raise exception 'La auditoría no coincide.';end if;
  actual:=(select coalesce(jsonb_object_agg(id,value),'{}'::jsonb) from mc_private.archives where activity=unit.unit);
  if actual is distinct from j->'archives' then raise exception 'Las temporadas archivadas no coinciden.';end if;
  expected:=(select coalesce(jsonb_object_agg(x->>0,jsonb_build_array(x->>1,x->>2,(x->>3)::jsonb)),'{}'::jsonb) from jsonb_array_elements(j->'receipts')x);
  actual:=(select coalesce(jsonb_object_agg(id,jsonb_build_array(actor,hash,result)),'{}'::jsonb) from mc_private.receipts where activity=unit.unit);
  if actual is distinct from expected then raise exception 'Los recibos de operación no coinciden.';end if;
 end loop;
end$$;
select 'VERIFICACION_COMPLETA_OK' as verification,
 (select count(*) from mc_private.users) as users,
 (select count(*) from mc_private.activities) as activities,
 (select count(*) from mc_private.receipts) as receipts;
