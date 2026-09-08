-- Migration 081: keep the advanced Hunt map projection type-safe
--
-- Migration 078 replaces the initial map projection but returns the integer
-- geofence radius through a DOUBLE PRECISION result column. Keep the public
-- projection contract stable by casting the display radius explicitly.

CREATE OR REPLACE FUNCTION public.get_active_hunt_stop_locations(p_participation_id UUID)
RETURNS TABLE (
  stop_id UUID,
  public_lat DOUBLE PRECISION,
  public_lng DOUBLE PRECISION,
  public_radius DOUBLE PRECISION,
  stop_title TEXT,
  stop_role TEXT,
  progress_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_hunt_reveals(p_participation_id);
  RETURN QUERY
  SELECT DISTINCT ON (hs.id)
    hs.id,
    hsg.public_lat,
    hsg.public_lng,
    hsg.public_radius_meters::DOUBLE PRECISION,
    hs.title,
    hs.stop_role::TEXT,
    hsp.status::TEXT
  FROM hunt_participants hp
  JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id = hp.id
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  JOIN hunt_stop_geofences hsg ON hsg.hunt_stop_id = hs.id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status IN ('active', 'paused')
    AND hsp.revealed_at IS NOT NULL
    AND hs.reveal_mode <> 'CLUE_ONLY'
    AND hsg.public_lat IS NOT NULL
    AND hsg.public_lng IS NOT NULL
  ORDER BY hs.id, hsg.is_validation_zone DESC NULLS LAST;
END;
$$;