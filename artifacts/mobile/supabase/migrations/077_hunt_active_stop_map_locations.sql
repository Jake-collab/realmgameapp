-- Migration 077: participant-authorized public locations for active Hunt stops
--
-- Public coordinates are display-only and are never the validation geometry.
-- A participant may only receive locations for stops already revealed to that
-- participant's active session. Locked/future stop locations stay server-side.

CREATE OR REPLACE FUNCTION public.get_active_hunt_stop_locations(
  p_participation_id UUID
)
RETURNS TABLE (
  stop_id       UUID,
  public_lat    DOUBLE PRECISION,
  public_lng    DOUBLE PRECISION,
  public_radius DOUBLE PRECISION,
  stop_title    TEXT,
  stop_role     TEXT,
  progress_status TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ON (hs.id)
    hs.id,
    hsg.public_lat,
    hsg.public_lng,
    hsg.public_radius_meters,
    hs.title,
    hs.stop_role::TEXT,
    hsp.status::TEXT
  FROM public.hunt_participants hp
  JOIN public.hunt_stop_progress hsp
    ON hsp.hunt_participant_id = hp.id
  JOIN public.hunt_stops hs
    ON hs.id = hsp.hunt_stop_id
  JOIN public.hunt_stop_geofences hsg
    ON hsg.hunt_stop_id = hs.id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status IN ('active', 'paused')
    AND hsp.status::TEXT NOT IN ('not_started', 'locked', 'expired')
    AND hsg.public_lat IS NOT NULL
    AND hsg.public_lng IS NOT NULL
  ORDER BY hs.id, hsg.is_validation_zone DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_active_hunt_stop_locations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_hunt_stop_locations(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_active_hunt_stop_locations(UUID) IS
  'Returns only participant-authorized public display coordinates for revealed active Hunt stops. '
  'Never returns validation geometry or locked/future stop locations.';