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
    </Stack>
  );
}
