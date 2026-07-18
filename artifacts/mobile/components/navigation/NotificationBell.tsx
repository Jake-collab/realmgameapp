/**
 * NotificationBell
 *
 * Top-header right action. Shows unread count badge.
 * Used in both Quest and Hunt tab layouts.
 *
 * Tapping navigates to the notifications screen (future).
 * Currently shows an alert placeholder until notifications are built (Build 11).
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAppStore } from '@/lib/store';

export default function NotificationBell() {
  const colors = useColors();
  const unreadCount = useAppStore((s) => s.unreadCount);

  function handlePress() {
    // TODO (Build 11): Navigate to notifications screen
    Alert.alert('Notifications', 'Notifications screen coming in Build 11.');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      accessibilityRole="button"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={({ pressed }) => [
        styles.root,
        { opacity: pressed ? 0.65 : 1, marginRight: spacing[2] },
      ]}
    >
      <Feather name="bell" size={22} color={colors.foreground} />
      {unreadCount > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.destructive },
          ]}
        >
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
});
