-- ============================================================
-- Migration 004 — Media Assets and Storage Policies
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- media_assets : centralized registry for all user-uploaded content.
--
-- Storage buckets must be created through the Supabase dashboard or
-- CLI. This migration documents the expected bucket names and policies
-- as SQL comments + storage.objects RLS where the Supabase version
-- supports it. See docs/STORAGE_ARCHITECTURE.md for full bucket setup.
--
-- Buckets to create manually:
--   avatars             (public=false)
--   quest-media         (public=false; approved items served via signed URL)
--   hunt-media          (public=false)
--   custom-game-media   (public=false)
--   proof-submissions   (public=false, NEVER public)
--   moderation-quarantine (public=false, restricted)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- media_assets
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  bucket              TEXT NOT NULL,         -- storage bucket name
  storage_path        TEXT NOT NULL,         -- path within bucket
  media_type          media_type NOT NULL,
  mime_type           TEXT NOT NULL,
  file_size           BIGINT,                -- bytes
  width               INTEGER,               -- pixels (images/video)
  height              INTEGER,               -- pixels (images/video)
  alt_text            TEXT,
  purpose             TEXT NOT NULL,         -- e.g. 'avatar', 'quest_cover', 'proof'
  visibility          media_visibility NOT NULL DEFAULT 'private',
  moderation_status   moderation_status NOT NULL DEFAULT 'pending',
  moderation_reason   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,           -- soft delete

  CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0),
  CONSTRAINT valid_dimensions CHECK (
    (width IS NULL AND height IS NULL) OR
    (width > 0 AND height > 0)
  )
);

COMMENT ON TABLE media_assets IS
  'Centralized registry for all uploaded files. Visibility and moderation_status '
  'control whether files can be accessed via public or signed URL. '
  'Never directly expose storage_path to clients; generate a time-limited signed URL.';

COMMENT ON COLUMN media_assets.bucket IS 'Storage bucket name: avatars | quest-media | hunt-media | custom-game-media | proof-submissions | moderation-quarantine';
COMMENT ON COLUMN media_assets.visibility IS 'private: signed URL only. restricted: signed URL for authorized users. public: public URL (only after moderation_status=approved).';
COMMENT ON COLUMN media_assets.deleted_at IS 'Soft delete. Physical file removal from storage is a separate cleanup job.';

CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Storage bucket policy documentation
-- ──────────────────────────────────────────────────────────────
-- Apply the following policies via Supabase dashboard or CLI.
-- See docs/STORAGE_ARCHITECTURE.md for the full runbook.
--
-- BUCKET: avatars
--   INSERT policy: auth.uid()::text = (storage.foldername(name))[1]
--     (users may only upload to their own folder: avatars/{user_id}/...)
--   SELECT policy: visibility = 'public' AND moderation_status = 'approved'
--     OR auth.uid() = owner_user_id
--   DELETE policy: auth.uid() = owner_user_id
--
-- BUCKET: quest-media
--   INSERT: auth.role() = 'service_role'  (admin/server only)
--   SELECT: moderation_status = 'approved' AND visibility = 'public'
--     OR auth.role() = 'service_role'
--
-- BUCKET: hunt-media
--   INSERT: auth.role() = 'service_role'
--   SELECT: (hunt is public AND approved) OR participant OR service_role
--
-- BUCKET: custom-game-media
--   INSERT: auth.uid() = creator_user_id (via join to hunts table)
--   SELECT: participant OR creator OR service_role
--
-- BUCKET: proof-submissions
--   INSERT: auth.uid() = owner_user_id
--   SELECT: auth.uid() = owner_user_id OR service_role
--   UPDATE/DELETE: service_role only
--
-- BUCKET: moderation-quarantine
--   ALL: service_role only (no end-user access ever)
-- ──────────────────────────────────────────────────────────────
