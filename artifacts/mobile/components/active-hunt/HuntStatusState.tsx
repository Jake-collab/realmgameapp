/**
 * HuntStatusState — Worlds (Prompt 13)
 *
 * Full-screen state display for non-active hunt states:
 *   - withdrawn
 *   - removed
 *   - cancelled
 *   - expired
 *   - not_found / unauthorized
 *
 * Rules:
 * - Never exposes internal moderator notes or removal reasons
 * - Shows user-safe explanation only
 * - Always provides a navigation exit
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { ActiveHuntViewMode } from '@/features/active-hunt/types/activeHunt.types';

const STATE_CONFIGS: Record<ActiveHuntViewMode, {
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  showSupport: boolean;
}> = {
  loading: { icon: 'loader', iconColor: '#6B7280', title: '', body: '', showSupport: false },
  active: { icon: 'flag', iconColor: '#10B981', title: '', body: '', showSupport: false },
  paused: { icon: 'pause-circle', iconColor: '#F59E0B', title: 'Hunt Paused', body: 'This hunt has been temporarily paused. Check back soon.', showSupport: false },
  completed: { icon: 'check-circle', iconColor: '#10B981', title: 'Hunt Completed', body: "You've completed this hunt!", showSupport: false },
  withdrawn: {
    icon:      'log-out',
    iconColor: '#6B7280',
    title:     'You Withdrew from This Hunt',
    body:      'Your hunt history and completed stops have been preserved.',
    showSupport: false,
  },
  removed: {
    icon:      'user-x',
    iconColor: '#EF4444',
    title:     'Removed from Hunt',
    body:      'You have been removed from this hunt. Your previous progress has been preserved.',
    showSupport: true,
  },
  cancelled: {
    icon:      'x-circle',
    iconColor: '#EF4444',
    title:     'Hunt Cancelled',
    body:      'This hunt was cancelled. Your completed stops and submitted proof are preserved in your history.',
    showSupport: true,
  },
  expired: {
    icon:      'clock',
    iconColor: '#F59E0B',
    title:     'Hunt Ended',
    body:      'The completion window for this hunt has passed. Your progress is preserved.',
    showSupport: false,
  },
  not_found: {
    icon:      'alert-circle',
    iconColor: '#6B7280',
    title:     'Hunt Not Found',
    body:      'This hunt could not be found or is no longer available.',
    showSupport: false,
  },
  unauthorized: {
    icon:      'lock',
    iconColor: '#6B7280',
    title:     'Access Denied',
    body:      'You do not have access to this hunt.',
    showSupport: false,
  },
};

interface HuntStatusStateProps {
  mode: ActiveHuntViewMode;
  huntTitle?: string;
}

export function HuntStatusState({ mode, huntTitle }: HuntStatusStateProps) {
  const colors = useColors();
  const config = STATE_CONFIGS[mode];

  if (!config || mode === 'loading' || mode === 'active') return null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name={config.icon as any} size={48} color={config.iconColor} />
        <Text style={[styles.title, { color: colors.foreground }]}>{config.title}</Text>
        {huntTitle && (
          <Text style={[styles.huntName, { color: colors.mutedForeground }]}>{huntTitle}</Text>
        )}
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{config.body}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.replace('/(main)/hunt/my-hunts')}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.hunt }]}
          accessibilityLabel="Return to My Hunts"
        >
          <Text style={styles.btnPrimaryText}>Return to My Hunts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(main)/hunt')}
          style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
          accessibilityLabel="Explore Hunt Map"
        >
          <Text style={[styles.btnSecondaryText, { color: colors.foreground }]}>Explore Hunt Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing[6],
    gap:            spacing[6],
  },
  card: {
    borderRadius: radius.xl,
    borderWidth:  1,
    padding:      spacing[6],
    alignItems:   'center',
    gap:          spacing[3],
    width:        '100%',
    maxWidth:     360,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize:   fontSize.xl,
    textAlign:  'center',
  },
  huntName: {
    fontFamily: fontFamily.medium,
    fontSize:   fontSize.sm,
    textAlign:  'center',
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.sm,
    textAlign:  'center',
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap:   spacing[3],
  },
  btn: {
    paddingVertical:   spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius:      radius.xl,
    alignItems:        'center',
  },
  btnPrimary: {},
  btnSecondary: {
    borderWidth: 1,
  },
  btnPrimaryText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.base,
    color:      '#fff',
  },
  btnSecondaryText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.base,
  },
});
