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