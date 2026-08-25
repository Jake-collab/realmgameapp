-- ============================================================
-- Migration 051 — Canonical private Storage buckets and policies
-- Worlds — Build 1
-- ============================================================
-- Every Worlds media bucket is private. Approved media is exposed
-- through a short-lived signed URL only after its media_assets record
-- is explicitly marked public and approved.
-- ============================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'avatars',
    'avatars',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'quest-media',
    'quest-media',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  ),
  (
    'hunt-media',
    'hunt-media',
    false,
    20971520,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
  ),
  (
    'custom-game-media',
    'custom-game-media',
    false,
    20971520,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'proof-submissions',
    'proof-submissions',
    false,
    26214400,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
  ),
  (
    'moderation-quarantine',
    'moderation-quarantine',
    false,
    26214400,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Preserve legacy buckets without deleting them, but remove their
-- permanent public exposure. No current runtime code references them.
UPDATE storage.buckets
SET public = false
WHERE id IN ('quest-proofs', 'hunt-drops');

CREATE OR REPLACE FUNCTION public.can_manage_hunt_media_storage(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.hunts
      WHERE id::TEXT = split_part(p_object_name, '/', 1)
        AND creator_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_approved_storage_media(
  p_bucket_id TEXT,
  p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.media_assets
    WHERE bucket = p_bucket_id
      AND storage_path = p_object_name
      AND visibility = 'public'
      AND moderation_status = 'approved'
      AND deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_hunt_media_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_approved_storage_media(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_hunt_media_storage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_approved_storage_media(TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "worlds_avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_avatars_select_owner_or_approved" ON storage.objects;
DROP POLICY IF EXISTS "worlds_avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_avatars_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_proofs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_proofs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_proofs_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "worlds_hunt_creator_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "worlds_hunt_creator_media_select" ON storage.objects;
DROP POLICY IF EXISTS "worlds_hunt_creator_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "worlds_approved_media_select" ON storage.objects;

CREATE POLICY "worlds_avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "worlds_avatars_select_owner_or_approved"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  OR public.can_read_approved_storage_media(bucket_id, name)
);

CREATE POLICY "worlds_avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "worlds_avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "worlds_proofs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proof-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND array_length(storage.foldername(name), 1) >= 3
);

CREATE POLICY "worlds_proofs_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proof-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "worlds_proofs_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proof-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY "worlds_hunt_creator_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'custom-game-media'
  AND public.can_manage_hunt_media_storage(name)
);

CREATE POLICY "worlds_hunt_creator_media_select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  (
    bucket_id = 'custom-game-media'
    AND auth.uid() IS NOT NULL
    AND public.can_manage_hunt_media_storage(name)
  )
  OR public.can_read_approved_storage_media(bucket_id, name)
);

CREATE POLICY "worlds_hunt_creator_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'custom-game-media'
  AND public.can_manage_hunt_media_storage(name)
);

CREATE POLICY "worlds_approved_media_select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id IN ('quest-media', 'hunt-media')
  AND public.can_read_approved_storage_media(bucket_id, name)
);