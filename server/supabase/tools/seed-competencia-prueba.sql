-- Datos ficticios autorizados el 26/11/2026. Repetible sin duplicados.
-- Usa el commit operativo: auditoría, versiones y sincronización con Sheets.
begin;
do $$
declare
 activity_name text:='Hockey sobre Patines Caballeros';
 category_name text:='PRUEBA COMPETENCIA'; team_name text:='Ficticio';
 request_id text:='seed_competencia_hockey_20261126';
 competition_id uuid:='aa261126-0001-4000-8000-000000000001';
 owner_id text; actor jsonb; loaded jsonb; operation jsonb; result jsonb;
 players jsonb; competition_roster jsonb; old_data jsonb; after_data jsonb;
 op_key text:='["ALTA_PADRON","prueba competencia","ficticio","",""]';
 roster_key text:='["PADRON","prueba competencia","ficticio","",""]';
 events jsonb;
begin
 select owner_uid into strict owner_id from mc_private.settings where id;
 select record into strict actor from mc_private.users where uid=owner_id;
 perform pg_advisory_xact_lock(hashtextextended(request_id,0));
 select jsonb_agg(jsonb_build_object(
  'id','prueba-hockey-20261126-'||lpad(n::text,2,'0'),
  'categoria',category_name,'equipo',team_name,
  'jugador','PRUEBA · Jugador '||lpad(n::text,2,'0'),'dni','') order by n)
 into players from generate_series(1,8) n;
 if not exists(select 1 from mc_private.receipts where activity=activity_name and id=request_id) then
  loaded:=public.mc_service('load',jsonb_build_object('uid',owner_id,'activity',activity_name));
  select data into old_data from mc_private.records where activity=activity_name and kind='padron'
   and key=jsonb_build_array(category_name,team_name);
  if old_data is not null and jsonb_array_length(coalesce(old_data->'rows','[]'))>0 then
   raise exception 'El grupo de prueba ya contiene datos. Revisar sin reemplazarlos.';
  end if;
  operation:=jsonb_build_object('tipo','ALTA_PADRON','deporte',activity_name,
   'categoria',category_name,'equipo',team_name,'requestId',request_id,
   'temporada',loaded#>'{meta,temporada}',
   'revision',coalesce(loaded->'versions'->op_key,'0'::jsonb),
   'rosterRevision',coalesce(loaded->'versions'->roster_key,'0'::jsonb),
   'accessVersion',actor->'version',
   'jugadores',(select jsonb_agg(jsonb_build_object('jugador',p->>'jugador')) from jsonb_array_elements(players) p));
  after_data:=jsonb_build_object('kind','padron','rows',players);
  result:=public.mc_commit(jsonb_build_object(
   'uid',owner_id,'actorVersion',actor->'version','activity',activity_name,
   'operation',operation,'hash',encode(sha256(convert_to((operation-'accessVersion')::text,'UTF8')),'hex'),
   'resource',op_key,'rosterKey',roster_key,'checkRoster',true,'rosterChanged',true,
   'baseVersion',loaded#>'{meta,version}',
   'changes',jsonb_build_array(jsonb_build_object('kind','padron','key',jsonb_build_array(category_name,team_name),
    'before',coalesce(old_data,'null'::jsonb),'after',after_data)),
   'fichas','[]'::jsonb,'archive','null'::jsonb,
   'audit',jsonb_build_object('id',request_id,'fecha',now(),'uid',owner_id,
    'autor',actor->>'nombre','rol',actor->>'rol','tipo','ALTA_PADRON','deporte',activity_name,
    'categoria',category_name,'equipo',team_name,'jugador','',
    'antes',coalesce(old_data->'rows','[]'::jsonb),'despues',players,
    'nota','Datos ficticios para probar Competencia. Sin DNI ni legajos.')));
  if coalesce((result->>'ok')::boolean,false) is not true then raise exception 'No se confirmó la carga: %',result; end if;
 end if;
 if not exists(select 1 from mc_private.mc_competitions where id=competition_id) then
  select jsonb_agg(jsonb_build_object('player_id',p->>'id','player_name',p->>'jugador'))
  into competition_roster from jsonb_array_elements(players) p;
  events:='[
   {"side":"muni","action_code":"gol_jugada","action_label":"Gol Jugada","points_delta":1,"period":"1T","player_id":"prueba-hockey-20261126-02","player_name":"PRUEBA · Jugador 02","meta_json":{}},
   {"side":"muni","action_code":"falta_equipo","action_label":"Falta Equipo","points_delta":0,"period":"1T","player_id":null,"player_name":null,"meta_json":{}},
   {"side":"rival","action_code":"gol_rival","action_label":"+1 Gol Rival","points_delta":1,"period":"1T","player_id":null,"player_name":null,"meta_json":{}},
   {"side":"muni","action_code":"gol_penal","action_label":"Gol Penal","points_delta":1,"period":"2T","player_id":"prueba-hockey-20261126-04","player_name":"PRUEBA · Jugador 04","meta_json":{}},
   {"side":"muni","action_code":"azul","action_label":"Azul","points_delta":0,"period":"2T","player_id":"prueba-hockey-20261126-06","player_name":"PRUEBA · Jugador 06","meta_json":{}},
   {"side":"muni","action_code":"gol_jugada","action_label":"Gol Jugada","points_delta":1,"period":"2T","player_id":"prueba-hockey-20261126-02","player_name":"PRUEBA · Jugador 02","meta_json":{}}
  ]'::jsonb;
  result:=public.mc_competencia('save',jsonb_build_object('uid',owner_id,
   'competition',jsonb_build_object('id',competition_id,'revision',0,'activity_id',activity_name,
    'category',category_name,'date_ar','2026-11-26T18:00:00-03:00','mode','post','archetype','A',
    'opponent_or_event','PRUEBA · Club Ficticio','status','final','score_muni',3,'score_rival',1,
    'fair_play_ugi',true,'summary_json',jsonb_build_object('sportKey','hockey_patines','team',team_name,'ficticio',true)),
   'roster',competition_roster,'events',events));
  if coalesce((result->>'ok')::boolean,false) is not true then raise exception 'No se confirmó el partido: %',result; end if;
 end if;
end $$;
commit;
