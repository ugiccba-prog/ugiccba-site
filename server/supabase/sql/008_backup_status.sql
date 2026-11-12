begin;
create function mc_private.backup_status(p_uid text) returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb;begin
 if not exists(select 1 from mc_private.settings s join mc_private.users u on u.uid=s.owner_uid where s.id and u.uid=p_uid and u.record->>'status'='activo' and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now())) then raise exception using errcode='42501',message='Estado de respaldo privado.';end if;
 select backup_report into report from mc_private.maintenance where id;
 if report is null then return null;end if;
 return jsonb_build_object('ok',report->'ok','fecha',report->>'fecha','copias',1);
end$$;
revoke all on function mc_private.backup_status(text) from public,anon,authenticated;grant execute on function mc_private.backup_status(text) to service_role;
create function public.mc_backup_status(p_uid text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.backup_status(p_uid);$$;
revoke all on function public.mc_backup_status(text) from public,anon,authenticated;grant execute on function public.mc_backup_status(text) to service_role;
commit;
