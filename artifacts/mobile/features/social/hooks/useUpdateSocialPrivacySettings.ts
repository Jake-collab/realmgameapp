import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { updateSocialPrivacySettings } from '../repositories/social.repository';
import { getPrivacyUpdateInvalidationKeys, socialKeys } from '../queries/socialKeys';
import type { SocialPrivacySettingsUpdate } from '../types/social.types';

export function useUpdateSocialPrivacySettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (updates: SocialPrivacySettingsUpdate) => updateSocialPrivacySettings(updates),
    onSuccess: (updated) => {
      const viewerId = user?.id ?? '';
      // Update cache immediately with server-returned value
      queryClient.setQueryData(socialKeys.privacySettings(viewerId), updated);
      getPrivacyUpdateInvalidationKeys(viewerId).forEach(key =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    },
    retry: 0,
  });
}
