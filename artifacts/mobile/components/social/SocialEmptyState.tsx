/**
 * SocialEmptyState — deliberate empty states for social screens.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

type SocialEmptyVariant =
  | 'friends'
  | 'requests_received'
  | 'requests_sent'
  | 'search_before'
  | 'search_no_results'
  | 'blocked_users'
  | 'progression_hidden';

const EMPTY_CONFIGS: Record<SocialEmptyVariant, { icon: string; title: string; body: string; action?: string }> = {
  friends: {
    icon: 'users', title: 'No friends yet',
    body: 'Friends you connect with will appear here.',
    action: 'Find People',
  },
  requests_received: {
    icon: 'user-plus', title: 'No pending requests',
    body: "You don't have any pending friend requests.",
  },
  requests_sent: {
    icon: 'send', title: 'No sent requests',
    body: "You haven't sent any pending friend requests.",
  },
  search_before: {
    icon: 'search', title: 'Find people',
    body: 'Search by username to find people you know.',
  },
  search_no_results: {
    icon: 'search', title: 'No results',
    body: 'No matching profiles were found.',
  },
  blocked_users: {
    icon: 'slash', title: 'No blocked users',
    body: "You haven't blocked anyone.",
  },
  progression_hidden: {
    icon: 'lock', title: 'Progression private',
    body: 'This user keeps their progression private.',
  },
};

interface SocialEmptyStateProps {
  variant: SocialEmptyVariant;
  onAction?: () => void;
}

export function SocialEmptyState({ variant, onAction }: SocialEmptyStateProps) {
  const colors = useColors();
  const cfg = EMPTY_CONFIGS[variant];
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.iconCircle, { backgroundColor: colors.muted }]}>
        <Feather name={cfg.icon as any} size={24} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{cfg.title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{cfg.body}</Text>
      {cfg.action && onAction && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={cfg.action}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{cfg.action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[10], paddingHorizontal: spacing[6] },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
  actionBtn: { paddingVertical: spacing[3], paddingHorizontal: spacing[6], borderRadius: radius.xl, marginTop: spacing[2] },
  actionText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
