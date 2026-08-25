import { isExpiredAuthCallbackError, parseAuthCallbackUrl } from '@/features/auth/authCallback';

describe('parseAuthCallbackUrl', () => {
  it('reads implicit-flow credentials exclusively from the fragment', () => {
    const callback = parseAuthCallbackUrl(
      'worlds://auth-callback?type=signup#access_token=access&refresh_token=refresh&type=recovery'
    );

    expect(callback).toEqual(expect.objectContaining({
      accessToken: 'access',
      refreshToken: 'refresh',
      type: 'recovery',
      code: null,
    }));
  });

  it('reads PKCE codes and callback errors from query parameters', () => {
    const callback = parseAuthCallbackUrl(
      'https://matterrealm.com/auth/callback?code=pkce-code&type=recovery&error_code=otp_expired'
    );

    expect(callback).toEqual(expect.objectContaining({
      code: 'pkce-code',
      type: 'recovery',
      errorCode: 'otp_expired',
      accessToken: null,
      refreshToken: null,
    }));
  });

  it('classifies expired and denied links without showing provider details', () => {
    expect(isExpiredAuthCallbackError('otp_expired')).toBe(true);
    expect(isExpiredAuthCallbackError('access_denied')).toBe(true);
    expect(isExpiredAuthCallbackError('unknown', 'Token expired')).toBe(true);
    expect(isExpiredAuthCallbackError('unknown', 'Unexpected request')).toBe(false);
  });
});