/**
 * ErrorState
 *
 * Full-screen error state for when a primary data load fails.
 * Always provides a retry action — never leave users stranded.
 *
 * Usage:
 *   <ErrorState
 *     title="Couldn't load quests"
 *     description="Check your connection and try again."
 *     onRetry={refetch}
 *   />
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from './Button';

interface Props {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Custom Feather icon. Defaults to 'alert-circle'. */
  icon?: React.ComponentProps<typeof Feather>['name'];
}

export default function ErrorState({
  title = 'Something went wrong',
  description = 'We hit an unexpected problem. Please try again.',
  onRetry,
  icon = 'alert-circle',
}: Props) {
  const colors = useColors();

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.destructive + '15', borderRadius: radius.xl },
        ]}
      >
        <Feather name={icon} size={32} color={colors.destructive} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </View>

      {onRetry && (
        <Button variant="primary" size="md" onPress={onRetry}>
          Try again
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    padding: spacing[8],
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
