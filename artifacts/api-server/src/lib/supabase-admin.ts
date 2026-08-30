type SupabaseResponse<T> = { data: T | null; error: string | null };

const canonicalStorageBuckets = new Set([
  'avatars',
  'quest-media',
  'hunt-media',
  'custom-game-media',
  'proof-submissions',
  'moderation-quarantine',
]);

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function supabaseAdminConfigured() {
  return Boolean(config());
}

export async function supabaseAdminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const credentials = config();
  if (!credentials) throw new Error('Supabase trusted access is unavailable.');
  const response = await fetch(`${credentials.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: credentials.key,
      authorization: `Bearer ${credentials.key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed with status ${response.status}.`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function supabaseAdminRpc<T>(
  functionName: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const credentials = config();
  if (!credentials) throw new Error('Supabase trusted access is unavailable.');
  const response = await fetch(`${credentials.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: 'POST',
    headers: {
      apikey: credentials.key,
      authorization: `Bearer ${credentials.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase RPC ${functionName} failed with status ${response.status}${detail ? `: ${detail.slice(0, 300)}` : '.'}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function createSupabaseStorageSignedUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const credentials = config();
  if (!credentials) throw new Error('Supabase trusted access is unavailable.');

  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(
    `${credentials.url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: credentials.key,
        authorization: `Bearer ${credentials.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );
  if (!response.ok) throw new Error(`Supabase Storage request failed with status ${response.status}.`);

  const payload = await response.json() as { signedURL?: unknown };
  if (typeof payload.signedURL !== 'string' || !payload.signedURL) {
    throw new Error('Supabase Storage did not return a signed URL.');
  }
  if (/^https?:\/\//i.test(payload.signedURL)) return payload.signedURL;
  return `${credentials.url}/storage/v1${payload.signedURL.startsWith('/') ? '' : '/'}${payload.signedURL}`;
}

export type SupabaseStorageDeleteResult = 'deleted' | 'missing';

function validateStorageObjectReference(bucket: string, objectPath: string) {
  if (
    !canonicalStorageBuckets.has(bucket)
    || objectPath.length === 0
    || objectPath.length > 1024
    || objectPath.startsWith('/')
    || objectPath.includes('\\')
    || objectPath.split('/').some(segment => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('Supabase Storage object reference is invalid.');
  }
}

/**
 * Remove one object through the service-role Storage API.
 *
 * The Storage API's remove endpoint accepts a list of paths. Sending one path
 * keeps the operation idempotent while using the same API contract as the
 * Supabase client. A 404 is a successful "already gone" outcome.
 */
export async function deleteSupabaseStorageObject(
  bucket: string,
  objectPath: string,
): Promise<SupabaseStorageDeleteResult> {
  const credentials = config();
  if (!credentials) throw new Error('Supabase trusted access is unavailable.');
  validateStorageObjectReference(bucket, objectPath);

  const response = await fetch(
    `${credentials.url}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: credentials.key,
        authorization: `Bearer ${credentials.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [objectPath] }),
    },
  );
  if (response.status === 404) return 'missing';
  if (!response.ok) {
    throw new Error(`Supabase Storage deletion failed with status ${response.status}.`);
  }
  return 'deleted';
}
