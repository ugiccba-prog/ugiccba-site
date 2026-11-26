begin;
-- 018_competencia.sql
-- Módulo Competencia Muni 360 (acceso exclusivo owner_uid vía Edge Function)

CREATE TABLE IF NOT EXISTS mc_private.mc_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  date_ar TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'post')),
  archetype TEXT NOT NULL CHECK (archetype IN ('A', 'B', 'C', 'D', 'E')),
  opponent_or_event TEXT NOT NULL,
  is_home BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'final')),
  score_muni INTEGER NOT NULL DEFAULT 0,
  score_rival INTEGER NOT NULL DEFAULT 0,
  fair_play_ugi BOOLEAN NOT NULL DEFAULT false,
  fair_play_note TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mc_private.mc_competition_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES mc_private.mc_competitions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  jersey_number TEXT,
  role TEXT NOT NULL DEFAULT 'titular' CHECK (role IN ('titular', 'suplente', 'individual')),
  played BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (competition_id, player_id)
);

CREATE TABLE IF NOT EXISTS mc_private.mc_competition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES mc_private.mc_competitions(id) ON DELETE CASCADE,
  player_id TEXT,
  player_name TEXT,
  side TEXT NOT NULL CHECK (side IN ('muni', 'rival')),
  action_code TEXT NOT NULL,
  action_label TEXT NOT NULL,
  points_delta INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT '1',
  seq_order INTEGER NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para historial por deporte y por jugador
CREATE INDEX IF NOT EXISTS idx_comp_activity_date ON mc_private.mc_competitions(activity_id, date_ar DESC);
CREATE INDEX IF NOT EXISTS idx_comp_roster_player ON mc_private.mc_competition_roster(player_id);
CREATE INDEX IF NOT EXISTS idx_comp_events_comp ON mc_private.mc_competition_events(competition_id, seq_order);
CREATE INDEX IF NOT EXISTS idx_comp_events_player ON mc_private.mc_competition_events(player_id);

-- RLS estricto: bloqueo total a anon y authenticated (solo service_role desde Edge Function)
ALTER TABLE mc_private.mc_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_private.mc_competition_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_private.mc_competition_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_direct_competitions ON mc_private.mc_competitions FOR ALL TO anon, authenticated USING (false);
CREATE POLICY deny_direct_comp_roster ON mc_private.mc_competition_roster FOR ALL TO anon, authenticated USING (false);
CREATE POLICY deny_direct_comp_events ON mc_private.mc_competition_events FOR ALL TO anon, authenticated USING (false);

REVOKE ALL ON mc_private.mc_competitions,mc_private.mc_competition_roster,mc_private.mc_competition_events FROM public,anon,authenticated;
CREATE FUNCTION public.mc_competencia(p_action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 c jsonb:=p->'competition'; existing mc_private.mc_competitions%rowtype; saved mc_private.mc_competitions%rowtype;
 settings mc_private.settings%rowtype; actor jsonb; cid uuid; item jsonb; result jsonb;
BEGIN
 SELECT * INTO STRICT settings FROM mc_private.settings WHERE id;
 SELECT record INTO actor FROM mc_private.users WHERE uid=p->>'uid' FOR SHARE;
 IF (p->>'uid') IS DISTINCT FROM settings.owner_uid OR (actor->>'status') IS DISTINCT FROM 'activo'
 OR (actor->>'expiresAt')::timestamptz<=now() THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acceso exclusivo del propietario.'; END IF;
 IF p_action='list' THEN
 RETURN jsonb_build_object('ok',true,'items',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY date_ar DESC),'[]') FROM
 (SELECT * FROM mc_private.mc_competitions ORDER BY date_ar DESC LIMIT 50) t));
 ELSIF p_action='detail' THEN
 cid:=(p->>'id')::uuid;
 SELECT to_jsonb(t) INTO result FROM mc_private.mc_competitions t WHERE id=cid;
 IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Competencia inexistente.'; END IF;
 RETURN jsonb_build_object('ok',true,'competition',result,
 'roster',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY player_name),'[]') FROM mc_private.mc_competition_roster t WHERE competition_id=cid),
 'events',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY seq_order),'[]') FROM mc_private.mc_competition_events t WHERE competition_id=cid));
 ELSIF p_action IS DISTINCT FROM 'save' THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acción inválida.';
 END IF;
 IF settings.mode<>'ready' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Muni360 está en mantenimiento.'; END IF;
 cid:=(c->>'id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('competencia:'||cid::text,0));
 SELECT * INTO existing FROM mc_private.mc_competitions WHERE id=cid FOR UPDATE;
 -- Exact retry remains safe after a lost response, including after finalization.
 IF FOUND AND existing.summary_json->'snapshot'=jsonb_build_object('competition',c,'roster',p->'roster','events',p->'events') THEN
 RETURN jsonb_build_object('ok',true,'id',cid,'revision',existing.revision); END IF;
 IF existing.id IS NOT NULL AND (existing.revision<>(c->>'revision')::bigint OR existing.status='final')
 OR existing.id IS NULL AND (c->>'revision')::bigint<>0 THEN
 RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='La competencia cambió o ya está finalizada. Recargá el historial.'; END IF;
 INSERT INTO mc_private.mc_competitions(id,activity_id,category,date_ar,mode,archetype,opponent_or_event,status,score_muni,score_rival,fair_play_ugi,summary_json,created_by,revision)
 VALUES(cid,c->>'activity_id',c->>'category',(c->>'date_ar')::timestamptz,c->>'mode',c->>'archetype',c->>'opponent_or_event',c->>'status',(c->>'score_muni')::int,(c->>'score_rival')::int,(c->>'fair_play_ugi')::boolean,
 (c->'summary_json')||jsonb_build_object('snapshot',jsonb_build_object('competition',c,'roster',p->'roster','events',p->'events')),p->>'uid',1)
 ON CONFLICT(id) DO UPDATE SET status=excluded.status,score_muni=excluded.score_muni,score_rival=excluded.score_rival,fair_play_ugi=excluded.fair_play_ugi,summary_json=excluded.summary_json,updated_at=now(),revision=mc_private.mc_competitions.revision+1
 RETURNING * INTO saved;
 DELETE FROM mc_private.mc_competition_events WHERE competition_id=cid;
 DELETE FROM mc_private.mc_competition_roster WHERE competition_id=cid;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'roster') LOOP
 INSERT INTO mc_private.mc_competition_roster(competition_id,player_id,player_name) VALUES(cid,item->>'player_id',item->>'player_name'); END LOOP;
 INSERT INTO mc_private.mc_competition_events(competition_id,player_id,player_name,side,action_code,action_label,points_delta,period,seq_order,meta_json)
 SELECT cid,e->>'player_id',e->>'player_name',e->>'side',e->>'action_code',e->>'action_label',(e->>'points_delta')::int,e->>'period',ord::int,e->'meta_json'
 FROM jsonb_array_elements(p->'events') WITH ORDINALITY AS entries(e,ord);
 RETURN jsonb_build_object('ok',true,'id',cid,'revision',saved.revision);
END $$;
REVOKE ALL ON FUNCTION public.mc_competencia(text,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mc_competencia(text,jsonb) TO service_role;
commit;
