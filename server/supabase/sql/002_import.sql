begin;
create function mc_private.import_part(p_secret text,p_unit text,p_part integer,p_total integer,p_checksum text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;prev mc_private.import_parts%rowtype;begin
 select * into strict c from mc_private.settings where id for update;
 if c.mode<>'preparing' or c.import_expires is null or c.import_expires<=now() or p_secret is null or p_secret !~ '^mci_[0-9a-f]{64}$' or c.import_hash is distinct from encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception using errcode='42501',message='Importación no autorizada o cerrada.';end if;
 if p_unit<>'global' and not(c.areas?p_unit) or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Unidad inválida.';end if;
 select * into prev from mc_private.import_parts where unit=p_unit and part=p_part;
 if prev.unit is not null then if prev.body<>p_body or prev.total<>p_total then raise exception using errcode='PT409',message='El origen cambió durante la exportación.';end if;return jsonb_build_object('ok',true,'duplicated',true);end if;
 if coalesce((select sum(octet_length(body)) from mc_private.import_parts),0)+octet_length(p_body)>100000000 then raise exception 'La importación supera el límite seguro de este ensayo.';end if;
 insert into mc_private.import_parts values(p_unit,p_part,p_total,p_body);
 return jsonb_build_object('ok',true,'part',p_part,'checksum',p_checksum);
end$$;
revoke all on function mc_private.import_part(text,text,integer,integer,text,text) from public;grant execute on function mc_private.import_part(text,text,integer,integer,text,text) to anon,authenticated;
create function public.mc_import_part(p_secret text,p_unit text,p_part integer,p_total integer,p_checksum text,p_body text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.import_part(p_secret,p_unit,p_part,p_total,p_checksum,p_body);$$;
revoke all on function public.mc_import_part(text,text,integer,integer,text,text) from public;grant execute on function public.mc_import_part(text,text,integer,integer,text,text) to anon,authenticated;
-- Finalization is service-only, never exposed to the export credential.
create function mc_private.import_unit(p_unit text,p_checksum text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare raw text;j jsonb;x record;row jsonb;kind text;keys text[];c mc_private.settings%rowtype;begin
 select * into strict c from mc_private.settings where id for update;
 if c.mode<>'preparing' then raise exception 'Importación cerrada.';end if;
 if (select count(*)<>max(total) or min(total)<>max(total) from mc_private.import_parts where unit=p_unit) is distinct from false then raise exception 'Faltan partes o el total no coincide.';end if;
 select string_agg(body,'' order by part) into raw from mc_private.import_parts where unit=p_unit;
 if encode(sha256(convert_to(raw,'UTF8')),'hex')<>p_checksum then raise exception 'La huella del origen no coincide.';end if;
 j:=raw::jsonb;
 if p_unit='global' then
  if j#>>'{config,owner}'<>c.owner_uid or j#>>'{config,project}'<>c.firebase_project or j#>'{config,areas}' is distinct from c.areas or length(j#>>'{config,idSecret}')<32 then raise exception 'Configuración de origen incorrecta.';end if;
  if exists(select 1 from mc_private.users) then raise exception 'Los usuarios ya fueron importados.';end if;
  update mc_private.settings set id_secret=j#>>'{config,idSecret}' where id;
  for row in select * from jsonb_array_elements(j#>'{users,users}') loop insert into mc_private.users values(row->>'uid',row);end loop;
  for x in select * from jsonb_each(j#>'{users,history}') loop insert into mc_private.permission_history values(x.key,x.value);end loop;
  for row in select * from jsonb_array_elements(j->'identities') loop insert into mc_private.identities values(row->>0,row->>1,row->>2);end loop;
  return jsonb_build_object('ok',true,'users',(select count(*) from mc_private.users));
 end if;
 if j->>'name'<>p_unit or not(c.areas?p_unit) or not exists(select 1 from mc_private.users where uid=c.owner_uid) then raise exception 'Origen o usuarios no verificados.';end if;
 insert into mc_private.activities(name,epoch,version) values(p_unit,(j#>>'{meta,temporada}')::integer,(j#>>'{meta,version}')::bigint);
 foreach kind in array array['padron','asistencia','evaluaciones','sesiones'] loop
  keys:=case kind when 'padron' then array['categoria','equipo'] when 'asistencia' then array['fecha','categoria','equipo'] when 'evaluaciones' then array['fecha','categoria','equipo','jugador'] else array['id'] end;
  insert into mc_private.records(activity,kind,key,data)
  select p_unit,kind,key,jsonb_build_object('kind',kind,'rows',jsonb_agg(value order by ord)) from (
   select value,ord,(select jsonb_agg(coalesce(value->>k,'') order by n) from unnest(keys) with ordinality q(k,n)) as key from jsonb_array_elements(j#>array['state',kind]) with ordinality z(value,ord)
  )grouped group by key;
 end loop;
 insert into mc_private.records values(p_unit,'config','[]'::jsonb,jsonb_build_object('kind','config','gestos',j#>'{state,gestos}','email',j#>>'{state,email}'));
 for x in select * from jsonb_each(j#>'{state,fichas}') loop insert into mc_private.fichas values(p_unit,x.key,x.value);end loop;
 for x in select * from jsonb_each(j->'versions') loop insert into mc_private.versions values(p_unit,x.key,(x.value#>>'{}')::bigint);end loop;
 for x in select * from jsonb_each(j->'audit') loop insert into mc_private.audit values(p_unit,x.key,x.value);end loop;
 for x in select * from jsonb_each(j->'archives') loop insert into mc_private.archives values(p_unit,x.key,x.value);end loop;
 for row in select * from jsonb_array_elements(j->'receipts') loop insert into mc_private.receipts values(p_unit,row->>0,row->>1,row->>2,(row->>3)::jsonb);end loop;
 for row in select * from jsonb_array_elements(j#>'{state,padron}') loop
  if coalesce(row->>'dni','')<>'' then
   if exists(select 1 from mc_private.identities where fingerprint=encode(sha256(convert_to(c.id_secret||':'||(row->>'dni'),'UTF8')),'hex') and id<>row->>'id') then raise exception 'El origen contiene una identidad de DNI incompatible.';end if;
   insert into mc_private.identities values(encode(sha256(convert_to(c.id_secret||':'||(row->>'dni'),'UTF8')),'hex'),row->>'id','activo') on conflict do nothing;
  end if;
 end loop;
 insert into mc_private.outbox(activity,version)values(p_unit,(j#>>'{meta,version}')::bigint);
 return jsonb_build_object('ok',true,'activity',p_unit,'roster',jsonb_array_length(j#>'{state,padron}'),'attendance',jsonb_array_length(j#>'{state,asistencia}'),'evaluations',jsonb_array_length(j#>'{state,evaluaciones}'));
end$$;
revoke all on function mc_private.import_unit(text,text) from public,anon,authenticated;grant execute on function mc_private.import_unit(text,text) to service_role;
create function public.mc_import_unit(p_unit text,p_checksum text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.import_unit(p_unit,p_checksum);$$;
revoke all on function public.mc_import_unit(text,text) from public,anon,authenticated;grant execute on function public.mc_import_unit(text,text) to service_role;
commit;
