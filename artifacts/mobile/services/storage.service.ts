/**
 * Storage service layer.
 *
 * Wraps Supabase Storage for file uploads and signed URL generation.
 *
 * Buckets (to be created in Supabase dashboard):
 *   - avatars are private, max 5 MB, images only
 *   - all approved media is served through short-lived signed URLs
 *
 * File naming convention:
 *   avatars/<userId>/avatar.<ext>
 */

import { requireSupabase } from './supabase';

type UploadResult = { url: string | null; error: string | null };
export type CanonicalStorageBucket =
  | 'avatars'
  | 'quest-media'
  | 'hunt-media'
  | 'custom-game-media'
  | 'proof-submissions'
  | 'moderation-quarantine';

export const storageService = {
  /** Upload a user avatar. Returns a short-lived signed URL. */
  async uploadAvatar(userId: string, uri: string): Promise<UploadResult> {
    const client = requireSupabase();
    const ext = uri.split('.').pop() ?? 'jpg';
    const filename = `${userId}/avatar.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { error } = await client.storage
      .from('avatars')
      .upload(filename, fileData, { contentType, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data, error: signedUrlError } = await client.storage
      .from('avatars')
      .createSignedUrl(filename, 3600);

    return { url: data?.signedUrl ?? null, error: signedUrlError?.message ?? null };
  },

  /** Delete a file from a bucket */
  async deleteFile(bucket: CanonicalStorageBucket, path: string): Promise<{ error: string | null }> {
    const client = requireSupabase();
    const { error } = await client.storage.from(bucket).remove([path]);
    return { error: error?.message ?? null };
  },

  /** Get a signed URL for private file access (60s expiry by default) */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn = 60
  ): Promise<{ url: string | null; error: string | null }> {
    try {
      const client = requireSupabase();
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      return { url: data?.signedUrl ?? null, error: error?.message ?? null };
    } catch (error) {
      // A revoked object, an expired URL, or an unavailable Storage
      // connection is a missing-media state for callers. Return it as data
      // so screens can render their fallback instead of throwing.
      return {
        url: null,
        error: error instanceof Error ? error.message : 'Media is unavailable.',
      };
    }
  },
};
