import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { socialKeys } from '../queries/socialKeys';
import { fetchSocialPrivacySettings } from '../repositories/social.repository';
import { PRIVACY_SETTINGS_STALE_MS } from '../constants/social.constants';

export function useSocialPrivacySettings() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey:  socialKeys.privacySettings(userId),
    queryFn:   fetchSocialPrivacySettings,
    enabled:   Boolean(userId),
    staleTime: PRIVACY_SETTINGS_STALE_MS,
    gcTime:    10 * 60 * 1000,
  });
}
