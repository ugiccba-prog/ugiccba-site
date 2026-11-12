begin;
alter table mc_private.staging add column updated_at timestamptz not null default now();
create function mc_private.worker_targets(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$begin perform mc_private.worker_auth(p_secret);return coalesce((select jsonb_agg(jsonb_build_object('activity',activity,'sheet_id',sheet_id) order by activity) from mc_private.sheet_targets),'[]'::jsonb);end$$;
revoke all on function mc_private.worker_targets(text) from public;grant execute on function mc_private.worker_targets(text) to anon,authenticated;
create function public.mc_worker_targets(p_secret text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.worker_targets(p_secret);$$;
revoke all on function public.mc_worker_targets(text) from public;grant execute on function public.mc_worker_targets(text) to anon,authenticated;
create function mc_private.worker_staging(p_secret text,p_activity text,p_sheet text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform mc_private.worker_auth(p_secret);
 if not exists(select 1 from mc_private.sheet_targets where activity=p_activity and sheet_id=p_sheet) or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500 then raise exception 'Carga o destino inválido.';end if;
 if exists(select 1 from jsonb_array_elements(p_rows)r where jsonb_typeof(r) is distinct from 'object' or length(coalesce(r->>'categoria',''))not between 1 and 160 or length(coalesce(r->>'equipo',''))not between 1 and 160 or length(coalesce(r->>'jugador',''))not between 1 and 160) then raise exception 'Filas de nombres inválidas.';end if;
 insert into mc_private.staging(activity,rows,updated_at) values(p_activity,p_rows,now()) on conflict(activity)do update set rows=excluded.rows,updated_at=excluded.updated_at;
 return jsonb_build_object('ok',true,'rows',jsonb_array_length(p_rows));
end$$;
revoke all on function mc_private.worker_staging(text,text,text,jsonb) from public;grant execute on function mc_private.worker_staging(text,text,text,jsonb) to anon,authenticated;
create function public.mc_worker_staging(p_secret text,p_activity text,p_sheet text,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select mc_private.worker_staging(p_secret,p_activity,p_sheet,p_rows);$$;
revoke all on function public.mc_worker_staging(text,text,text,jsonb) from public;grant execute on function public.mc_worker_staging(text,text,text,jsonb) to anon,authenticated;
commit;
