import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getMySettings, updateMySettings, type UpdateSettingsPayload } from '@/services/profile/profile.service';
import type { UserSettingsRow } from '@/lib/supabase/database.types';

export const defaultUserSettings: UserSettingsRow = {
  id: 'local', user_id: 'local',
  notify_quest_available: true, notify_monthly_drop: true,
  notify_hunt_invitation: true, notify_hunt_updates: true,
  notify_proof_decisions: true, notify_achievements: true,
  notify_admin_messages: true, notify_marketing: false,
  profile_visibility: 'public', leaderboard_visibility: true,
  allow_hunt_invitations: true, location_sharing_enabled: false,
  location_precision: 'approximate', preferred_units: 'imperial',
  theme_preference: 'system', reduce_motion: false,
  last_game_mode: 'quest', last_quest_tab: 'available',
  last_hunt_tab: 'my-hunts',
  onboarding_progress: {
    step: 'not_started', interests_saved: false,
    location_explanation_shown: false, location_permission_granted: false,
    starting_mode_selected: false,
  },
  created_at: '', updated_at: '',
};

export function useUserSettings() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['userSettings', userId],
    queryFn: () => getMySettings(userId),
    enabled: Boolean(userId) && isSupabaseConfigured(),
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => updateMySettings(user!.id, payload),
    onSuccess: settings => {
      if (user) queryClient.setQueryData(['userSettings', user.id], settings);
    },
  });
}