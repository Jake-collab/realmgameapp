import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="interests" />
      <Stack.Screen name="location" />
      <Stack.Screen name="starting-mode" />
      <Stack.Screen name="complete" options={{ animation: 'fade' }} />
    </Stack>
  );
}
