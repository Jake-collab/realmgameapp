type SupabaseResponse<T> = { data: T | null; error: string | null };

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