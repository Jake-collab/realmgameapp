/**
 * Main app layout — Worlds
 *
 * Container for the authenticated application. Hosts both the Quest
 * and Hunt navigators. Navigation between modes is handled by the
 * GameModeSwitcher in each mode's tab header, not by this layout.
 *
 * This layout uses headerShown: false — each child navigator manages
 * its own header (including the mode switcher and notification bell).
 */

import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function MainLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      {/* Game-mode navigators */}
      <Stack.Screen name="quest" />
      <Stack.Screen name="hunt" />

      {/* Quest flow screens — appear over the tab UI (no tab bar) */}
      <Stack.Screen
        name="quest-detail/[questId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="quest-active/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="quest-proof/[participationId]"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="quest-completion/[participationId]"
        options={{ animation: 'fade' }}
      />

      {/* Quest Progress deep screens — appear over the tab UI (no tab bar) */}
      <Stack.Screen
        name="quest-completion-detail/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="quest-other-activity/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="quest-submission/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="quest-point-history"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Hunt flow screens — appear over the tab UI (no tab bar) */}
      <Stack.Screen
        name="hunt-detail/[huntId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-invitation/[invitationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-ready/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-active/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-completion/[participationId]"
        options={{ animation: 'fade' }}
      />

      {/* Shared Progression deep screens — appear over the tab UI (no tab bar) */}
      <Stack.Screen
        name="profile-achievements"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="achievement-detail/[achievementId]"
        options={{ animation: 'slide_from_right' }}
      />

      {/* Social deep screens — Prompt 16 (no tab bar) */}
      <Stack.Screen
        name="public-profile/[userRef]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="friends"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="friend-requests"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="find-people"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="social-privacy"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="blocked-users"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />

      {/* Hunt Progress deep screens — appear over the tab UI (no tab bar) */}
      <Stack.Screen
        name="hunt-completion-detail/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-other-activity/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-submission-history/[participationId]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="hunt-point-history"
        options={{ animation: 'slide_from_right' }}
      />
      {/* Custom Hunt creator flow — no tab bar */}
      <Stack.Screen name="hunt/create" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/details" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/privacy" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/schedule" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/start" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/stops" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/stop/[stopId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/invite" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/preview" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="hunt/create/[draftId]/review" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
