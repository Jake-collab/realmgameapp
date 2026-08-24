/**
 * Hunt tab navigator — Worlds
 *
 * Four tabs (permanent — do not add or remove without explicit instruction):
 *   1. Map       (index)    — PRIMARY screen; live hunt map (Build 5+)
 *   2. My Hunts  (my-hunts) — In Action, Ready, Completed, Invitations
 *   3. Progress  (progress) — Leaderboards and personal stats
 *   4. Profile   (profile)  — Shared player profile
 *
 * Map is the default (index) so it opens immediately when Hunt is selected.
 *
 * Header contains:
 *   Left:  GameModeSwitcher (Hunt ▼)
 *   Right: NotificationBell
 *
 * Navigation rules enforced here:
 *   - No Discover tab
 *   - No Create tab (+ Create lives inside My Hunts)
 *   - No Notifications tab (accessed from header bell)
 *   - No Settings tab (accessed through Profile)
 *   - No Quest tab (Quest is a separate mode, not a tab)
 */

import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/hooks/useColors';
import GameModeSwitcher from '@/components/navigation/GameModeSwitcher';
import NotificationBell from '@/components/navigation/NotificationBell';

export default function HuntTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.hunt,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.foreground },
        headerTitle: '',
        headerLeft: () => <GameModeSwitcher currentMode="hunt" />,
        headerRight: () => <NotificationBell />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84, paddingBottom: 30 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      {/* 1. Map — primary, opens first */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          headerTitle: '',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="map.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="map-pin" size={22} color={color} />
            ),
        }}
      />

      {/* 2. My Hunts */}
      <Tabs.Screen
        name="my-hunts"
        options={{
          title: 'My Hunts',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="flag" tintColor={color} size={size} />
            ) : (
              <Feather name="flag" size={22} color={color} />
            ),
        }}
      />

      {/* 3. Progress */}
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="trophy" tintColor={color} size={size} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />

      {/* 4. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={size} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
