export interface ParsedAuthCallback {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

/**
 * Supabase sends implicit-flow credentials in the fragment and PKCE
 * authorization codes in the query string. Do not accept bearer credentials
 * from the query string, where they could be retained in browser history.
 */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback {
  const fragmentIndex = url.indexOf('#');
  const hash = fragmentIndex >= 0 ? url.slice(fragmentIndex + 1) : '';
  const beforeHash = fragmentIndex >= 0 ? url.slice(0, fragmentIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  const fragmentParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(query);
  const either = (key: string) => fragmentParams.get(key) ?? queryParams.get(key);

  return {
    accessToken: fragmentParams.get('access_token'),
    refreshToken: fragmentParams.get('refresh_token'),
    code: queryParams.get('code') ?? fragmentParams.get('code'),
    type: either('type'),
    errorCode: either('error_code') ?? either('error'),
    errorDescription: either('error_description'),
  };
}

export function isExpiredAuthCallbackError(errorCode: string | null, message?: string | null): boolean {
  if (errorCode === 'access_denied' || errorCode === 'otp_expired' || errorCode === 'flow_state_expired') {
    return true;
  }

  return Boolean(message?.toLowerCase().includes('expired'));
}