/**
 * Media Service — Worlds
 *
 * Handles media asset registration, signed URL generation, and proof uploads.
 * Physical file upload to Supabase Storage is handled here using the JS SDK.
 *
 * Security:
 *   - Users may only upload to their own folder within each bucket.
 *   - Proof files are always private — only signed URLs are generated.
 *   - moderation_status starts as 'pending' for all user uploads.
 *
 * TODO (Build 5+): Implement expo-image-picker integration.
 * TODO (Build 5+): Implement automatic content moderation webhook.
 */

import { requireSupabase } from '@/lib/supabase/client';
import { normalizeError, getSignedUrl } from '@/lib/supabase/helpers';
import type { MediaAssetRow, MediaType } from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadAvatarPayload {
  userId: string;
  fileUri: string;          // local file URI from expo-image-picker
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface RegisterMediaPayload {
  ownerUserId: string;
  bucket: string;
  storagePath: string;
  mediaType: MediaType;
  mimeType: string;
  purpose: string;
  fileSize?: number;
  width?: number;
  height?: number;
  altText?: string;
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

/**
 * Upload a new avatar image for the user.
 * Path convention: avatars/{userId}/avatar.{ext}
 * Returns the media asset row and a short-lived signed URL.
 *
 * NOTE: Full expo-image-picker integration is deferred to Build 5.
 * This function accepts a Blob/File for now.
 */
export async function uploadAvatar(
  userId: string,
  file: Blob,
  mimeType: string,
  meta?: { width?: number; height?: number; fileSize?: number }
): Promise<{ asset: MediaAssetRow; signedUrl: string | null }> {
  const client = requireSupabase();
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const storagePath = `${userId}/avatar.${ext}`;

  // Upload to storage
  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: true,  // replace existing avatar
    });

  if (uploadError) throw normalizeError(uploadError);

  // Register in media_assets table
  const asset = await registerMediaAsset({
    ownerUserId: userId,
    bucket: 'avatars',
    storagePath,
    mediaType: 'image',
    mimeType,
    purpose: 'avatar',
    ...meta,
  });

  const signedUrl = await getSignedUrl('avatars', storagePath, 3600);
  return { asset, signedUrl };
}

/**
 * Register a media asset in the database after successful storage upload.
 * Returns the created row.
 */
export async function registerMediaAsset(payload: RegisterMediaPayload): Promise<MediaAssetRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('media_assets')
    .insert({
      owner_user_id: payload.ownerUserId,
      bucket: payload.bucket,
      storage_path: payload.storagePath,
      media_type: payload.mediaType,
      mime_type: payload.mimeType,
      purpose: payload.purpose,
      visibility: 'private',          // always private until moderation approves
      moderation_status: 'pending',   // requires moderation before serving publicly
      file_size: payload.fileSize,
      width: payload.width,
      height: payload.height,
      alt_text: payload.altText,
    })
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

export async function uploadProofMediaFromUri(input: {
  userId: string; localUri: string; mimeType: string; fileSize?: number; proofId?: string; mediaType?: MediaType;
}): Promise<MediaAssetRow> {
  const response = await fetch(input.localUri);
  if (!response.ok) throw new Error(`Local media could not be read (${response.status})`);
  const blob = await response.blob();
  const ext = input.mimeType.split('/')[1] ?? 'jpg';
  const storagePath = `${input.userId}/${input.proofId ?? 'draft'}/${Date.now()}.${ext}`;
  const client = requireSupabase();
  const { error } = await client.storage.from('proof-submissions').upload(storagePath, blob, { contentType: input.mimeType, upsert: false });
  if (error) throw normalizeError(error);
  return registerMediaAsset({
    ownerUserId: input.userId, bucket: 'proof-submissions', storagePath, mediaType: input.mediaType ?? 'image',
    mimeType: input.mimeType, purpose: 'proof', fileSize: input.fileSize,
  });
}

// ─── URL resolution ───────────────────────────────────────────────────────────

/**
 * Resolve the URL for a media asset.
 * Returns a short-lived signed URL. Worlds buckets are private even
 * when an approved media asset is eligible for broad display.
 */
export async function resolveMediaUrl(
  asset: Pick<MediaAssetRow, 'bucket' | 'storage_path' | 'visibility' | 'moderation_status'>
): Promise<string | null> {
  return getSignedUrl(asset.bucket, asset.storage_path, 3600);
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

export async function softDeleteMedia(mediaId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('media_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', mediaId);

  if (error) throw normalizeError(error);
}
