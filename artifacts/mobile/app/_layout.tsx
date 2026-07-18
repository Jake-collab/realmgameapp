/**
 * Root layout — Worlds
 *
 * Responsibilities:
 * 1. Load fonts and hide the native splash screen
 * 2. Wrap the entire app with required providers
 * 3. Run the NavigationGuard to redirect users to the correct route group
 *
 * Route groups:
 *   (auth)        → unauthenticated users: welcome, login, signup, etc.
 *   (onboarding)  → authenticated but first-time users
 *   (main)        → authenticated + onboarded users: quest/ or hunt/
 */

import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/lib/store';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash from auto-hiding before we decide where to navigate.
SplashScreen.preventAutoHideAsync();

// ─── Navigation Guard ─────────────────────────────────────────────────────────
// Runs inside AuthProvider. Watches auth state and redirects to the correct
// route group. Only fires once per auth state change to prevent redirect loops.

function NavigationGuard() {
  const { isLoading, isAuthenticated } = useAuthContext();
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const activeMode = useAppStore((s) => s.activeMode);
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Wait until auth has resolved before routing
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inMain = segments[0] === '(main)';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && !hasOnboarded && !inOnboarding) {
      router.replace('/(onboarding)/welcome');
    } else if (isAuthenticated && hasOnboarded && !inMain) {
      // Return the user to the mode they were last using
      router.replace(activeMode === 'hunt' ? '/(main)/hunt' : '/(main)/quest');
    }

    hasNavigated.current = true;
  }, [isLoading, isAuthenticated, hasOnboarded]);

  return null;
}

// ─── Stack ───────────────────────────────────────────────────────────────────

function RootLayoutNav() {
  return (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Keep the native splash visible while fonts load
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
