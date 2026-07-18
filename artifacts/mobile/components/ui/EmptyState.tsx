/**
 * EmptyState
 *
 * Full-area placeholder shown when a list or screen has no content.
 * Always provides an icon, a title, a description, and an optional action.
 *
 * Usage:
 *   <EmptyState
 *     icon="compass"
 *     title="No quests yet"
 *     description="Your active quests will appear here."
 *     action={{ label: 'Browse Quests', onPress: () => router.push('/quests') }}
 *   />
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import Button from './Button';

interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface Props {
  /** Feather icon name */
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  action?: EmptyStateAction;
  /** Whether to take full remaining height. Default: true */
  fullHeight?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  fullHeight = true,
}: Props) {
  const colors = useColors();

  return (
    <View style={[styles.root, fullHeight && styles.fullHeight]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.muted, borderRadius: radius.xl },
        ]}
      >
        <Feather name={icon} size={32} color={colors.mutedForeground} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </View>

      {action && (
        <Button variant="outline" size="md" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    padding: spacing[8],
  },
  fullHeight: {
    flex: 1,
    minHeight: 300,
  },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
    maxWidth: 280,
  },
});
