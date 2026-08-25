# Storage Architecture — Worlds

All file uploads go through Supabase Storage. No direct S3 or CDN URLs in the application.

---

## Buckets

The canonical buckets are created by the Supabase migration set. They are all private:

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

The migration set is the executable source of truth:

- `051_storage_bucket_security.sql` creates the canonical private buckets, removes
  permanent public exposure from empty legacy buckets, and installs the core policies.
- `052_fix_proof_storage_folder_policy.sql` matches the real
  `{user_id}/{proof_id-or-draft}/{filename}` proof path.
- `053_split_hunt_media_read_policies.sql` keeps anonymous approved-media reads
  separate from creator-only Hunt-media authorization.

Policy behavior:

| Bucket | Authenticated client access | Public/anonymous access |
|---|---|---|
| `avatars` | Owner may upload, read, replace, and delete their folder | Only assets explicitly `public` and `approved` in `media_assets` |
| `quest-media`, `hunt-media` | Server-side service role writes | Only assets explicitly `public` and `approved` |
| `custom-game-media` | The Hunt creator may manage their Hunt paths | Only assets explicitly `public` and `approved` |
| `proof-submissions` | Owner may upload and read their proof path | Never |
| `moderation-quarantine` | None | Never |

The service role is server-only and bypasses Storage RLS for authorized moderation and
operational work. Do not add broad client policies to the quarantine or proof buckets.

---

## URL Strategy

| Content type | Access method | TTL |
|---|---|---|
| User's own avatar | Signed URL | 1 hour |
| Approved public avatar | Signed URL after approval | 1 hour |
| Published quest cover | Signed URL after approval | 1 hour |
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
  getSignedUrl() returns a readable, short-lived URL
Otherwise:
  getSignedUrl() returns a URL only when the caller is authorized
        ↓
If rejected:
  File moved to moderation-quarantine bucket
  media_assets.moderation_reason set
  User notified via notifications table
```

The automated moderation provider (AWS Rekognition, OpenAI Moderation, etc.) is not connected
in Build 1. The schema is ready; the webhook endpoint is implemented in a later build.
