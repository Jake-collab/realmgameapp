/**
 * Storage service layer.
 *
 * Wraps Supabase Storage for file uploads and signed URL generation.
 *
 * Buckets (to be created in Supabase dashboard):
 *   - avatars    public, max 5 MB, images only
 *   - game-media public, max 20 MB, images + video
 *
 * File naming convention:
 *   avatars/<userId>/<timestamp>.<ext>
 *   game-media/<mode>/<contentId>/<timestamp>.<ext>
 */

import { requireSupabase } from './supabase';

type UploadResult = { url: string | null; error: string | null };

export const storageService = {
  /** Upload a user avatar. Returns the public URL. */
  async uploadAvatar(userId: string, uri: string): Promise<UploadResult> {
    const client = requireSupabase();
    const ext = uri.split('.').pop() ?? 'jpg';
    const filename = `avatars/${userId}/${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { error } = await client.storage
      .from('avatars')
      .upload(filename, fileData, { contentType, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = client.storage.from('avatars').getPublicUrl(filename);

    return { url: data.publicUrl, error: null };
  },

  /** Delete a file from a bucket */
  async deleteFile(bucket: string, path: string): Promise<{ error: string | null }> {
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
    const client = requireSupabase();
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    return { url: data?.signedUrl ?? null, error: error?.message ?? null };
  },
};
