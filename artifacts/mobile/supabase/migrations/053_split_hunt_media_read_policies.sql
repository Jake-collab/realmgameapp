-- PostgreSQL may evaluate both sides of an OR in an RLS expression.
-- Keep the creator-only authorization helper out of anonymous policy evaluation.

DROP POLICY IF EXISTS "worlds_hunt_creator_media_select" ON storage.objects;
DROP POLICY IF EXISTS "worlds_hunt_creator_media_approved_public_select" ON storage.objects;

CREATE POLICY "worlds_hunt_creator_media_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'custom-game-media'
  AND (
    public.can_manage_hunt_media_storage(name)
    OR public.can_read_approved_storage_media(bucket_id, name)
  )
);

CREATE POLICY "worlds_hunt_creator_media_approved_public_select"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'custom-game-media'
  AND public.can_read_approved_storage_media(bucket_id, name)
);