# Storage Architecture — Worlds

All file uploads go through Supabase Storage. No direct S3 or CDN URLs in the application.

---

## Buckets

Create these buckets in **Supabase dashboard → Storage → New bucket** (all private):

| Bucket | Public | Purpose |
|---|---|---|
| `avatars` | No | User profile images |
| `quest-media` | No | Quest cover, detail, instructional images |
| `hunt-media` | No | Hunt cover images |
| `custom-game-media` | No | User-created Custom Game media |
| `proof-submissions` | No | Quest and hunt proof files |
| `moderation-quarantine` | No | Content under moderation (never public) |

---

## Path Conventions

```
avatars/
  {user_id}/avatar.{ext}

quest-media/
  {quest_id}/{purpose}/{media_asset_id}.{ext}

hunt-media/
  {hunt_id}/cover/{media_asset_id}.{ext}

custom-game-media/
  {hunt_id}/{stop_id}/{media_asset_id}.{ext}

proof-submissions/
  {user_id}/{quest_participation_id | hunt_stop_progress_id}/{media_asset_id}.{ext}

moderation-quarantine/
  {entity_type}/{entity_id}/{media_asset_id}.{ext}
```

---

## Storage RLS Policies

Apply these via Supabase dashboard (Storage → Policies) or CLI after creating buckets.

### avatars bucket

```sql
-- INSERT: users may only upload to their own folder
CREATE POLICY "avatars_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: owner always; public URL only if profile visibility allows + moderation approved
CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: owner only
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### quest-media bucket

```sql
-- INSERT/UPDATE/DELETE: service_role only (admin uploads)
-- SELECT: public for approved + published quest media
CREATE POLICY "quest_media_public_select"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'quest-media'
  -- Additional check via media_assets.moderation_status = 'approved' enforced in app layer
);
```

### proof-submissions bucket

```sql
-- INSERT: authenticated users upload to their own folder
CREATE POLICY "proof_submissions_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proof-submissions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: owner only (never public)
CREATE POLICY "proof_submissions_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proof-submissions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### moderation-quarantine bucket

```sql
-- ALL access: service_role only (no user policies at all)
-- No INSERT/SELECT/UPDATE/DELETE policies for any user role
```

---

## URL Strategy

| Content type | Access method | TTL |
|---|---|---|
| User's own avatar | Signed URL | 1 hour |
| Approved public avatar | Public URL (if profile visibility = public) | Permanent |
| Published quest cover | Public URL | Permanent |
| Draft quest media | Signed URL | 15 minutes |
| Proof files | Signed URL (owner/reviewer only) | 15 minutes |
| Quarantined files | Signed URL (service_role only) | 5 minutes |

**Rule**: Never return raw `storage_path` to clients. Always resolve to a URL in the service layer
(`media.service.ts` → `resolveMediaUrl()`).

---

## Moderation Flow

```
User uploads file
        ↓
File stored in bucket (private)
media_assets row created (moderation_status = 'pending')
        ↓
[Future] Webhook triggers automated moderation provider
        ↓
moderation_status → 'scanning' → 'approved' | 'rejected' | 'manual_review'
        ↓
If approved + visibility = 'public':
  getPublicUrl() returns readable URL
Otherwise:
  getSignedUrl() with owner/reviewer auth
        ↓
If rejected:
  File moved to moderation-quarantine bucket
  media_assets.moderation_reason set
  User notified via notifications table
```

The automated moderation provider (AWS Rekognition, OpenAI Moderation, etc.) is not connected
in Build 1. The schema is ready; the webhook endpoint is implemented in a later build.
