/**
 * Quest tab navigator — Worlds
 *
 * Five tabs (permanent — do not add or remove without explicit instruction):
 *   1. Home     (index)    — active quest + daily/monthly/geo summaries
 *   2. Quests   (quests)   — Daily, Monthly, Geo-Quest browse
 *   3. Map      (map)      — Mapbox quest waypoints (Build 5)
 *   4. Progress (progress) — Leaderboards, In Action, Completed
 *   5. Profile  (profile)  — Shared player profile
 *
 * Header contains:
 *   Left:  GameModeSwitcher (Quest ▼)
 *   Right: NotificationBell
 *
 * Navigation rules enforced here:
 *   - No Geo tab
 *   - No Discover tab
 *   - No Notifications tab (accessed from header bell)
 *   - No Settings tab (accessed through Profile)
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

export default function QuestTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.quest,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.foreground },
        headerTitle: '',
        headerLeft: () => <GameModeSwitcher currentMode="quest" />,
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
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={size} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />

      {/* 2. Quests */}
      <Tabs.Screen
        name="quests"
        options={{
          title: 'Quests',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="checklist" tintColor={color} size={size} />
            ) : (
              <Feather name="compass" size={22} color={color} />
            ),
        }}
      />

      {/* 3. Map */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerTitle: '',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="map" tintColor={color} size={size} />
            ) : (
              <Feather name="map" size={22} color={color} />
            ),
        }}
      />

      {/* 4. Progress */}
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

      {/* 5. Profile */}
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
    </Tabs>
  );
}
