/**
 * Root layout — Worlds
 *
 * Responsibilities:
 * 1. Load fonts (native splash stays visible while loading)
 * 2. Wrap the entire app with required providers
 * 3. Run the NavigationGuard to redirect based on the auth startup state machine
 *
 * Splash screen strategy:
 *   SplashScreen.preventAutoHideAsync() prevents the native splash from
 *   auto-hiding. Fonts load first (returning null keeps splash visible).
 *   NavigationGuard hides the splash ONLY after the auth state machine
 *   has resolved, preventing any flash of incorrect content.
 *
 * Route groups:
 *   (auth)        → unauthenticated | configuration_missing | error
 *   (onboarding)  → authenticated but first-time users
 *   (main)        → authenticated + onboarded users: quest/ or hunt/
 */

import React, { useEffect, useRef } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuthContext, type AuthStartupState } from '@/features/auth/AuthProvider';
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

// Prevent the native splash from auto-hiding.
// We will hide it manually once auth state is resolved.
SplashScreen.preventAutoHideAsync();

// ─── Navigation Guard ─────────────────────────────────────────────────────────
// Runs inside AuthProvider. Watches the startup state machine and redirects to
// the correct route group. Hides the splash after the first resolution.

function NavigationGuard() {
  const { startupState } = useAuthContext();
  const activeMode = useAppStore((s) => s.activeMode);
  const segments = useSegments();
  const router = useRouter();
  const hasHiddenSplash = useRef(false);
  const lastStartupState = useRef<AuthStartupState>('initializing');

  useEffect(() => {
    // While initializing, keep the splash visible — do nothing
    if (startupState === 'initializing') return;

    // Hide the splash exactly once after state resolves
    if (!hasHiddenSplash.current) {
      hasHiddenSplash.current = true;
      SplashScreen.hideAsync().catch(() => {
        // Swallow: may throw if called after auto-hide timeout
      });
    }

    // Avoid redundant navigation if state hasn't changed
    if (startupState === lastStartupState.current) return;
    lastStartupState.current = startupState;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inMain = segments[0] === '(main)';

    switch (startupState) {
      case 'configuration_missing':
      case 'unauthenticated':
        if (!inAuth) router.replace('/(auth)/welcome');
        break;

      case 'authenticated_needs_verification':
        if (!inAuth) router.replace('/(auth)/verify-email');
        break;

      case 'authenticated_needs_onboarding':
        if (!inOnboarding) router.replace('/(onboarding)/welcome');
        break;

      case 'authenticated_suspended':
        // Show suspended notice within the auth group
        if (!inAuth) router.replace('/(auth)/welcome');
        break;

      case 'authenticated_ready':
        if (!inMain) {
          router.replace(
            activeMode === 'hunt' ? '/(main)/hunt' : '/(main)/quest'
          );
        }
        break;

      case 'error':
        // Stay wherever we are — the error screen within the group handles this
        // If not in auth, redirect to auth where the error can be surfaced
        if (!inAuth) router.replace('/(auth)/welcome');
        break;
    }
  }, [startupState, activeMode, segments, router]);

  return null;
}

// ─── Root Stack ───────────────────────────────────────────────────────────────

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

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Keep the native splash visible while fonts load.
  // DO NOT call SplashScreen.hideAsync() here — NavigationGuard handles it
  // after auth state resolves, preventing flash of incorrect content.
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
