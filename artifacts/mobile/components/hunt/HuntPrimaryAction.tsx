/**
 * HuntPrimaryAction — Worlds
 *
 * Renders the single primary action button for a Hunt, driven by
 * the Prompt 11 action resolver output. Never duplicates resolver logic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import type { HuntAction } from '@/features/hunts/types/hunt.types';

interface HuntPrimaryActionProps {
  action: HuntAction;
  isLoading?: boolean;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function HuntPrimaryAction({
  action,
  isLoading = false,
  onPress,
  size = 'md',
  fullWidth = false,
}: HuntPrimaryActionProps) {
  const colors = useColors();
  const disabled = !action.isEnabled || isLoading;

  const label = isLoading && action.loadingBehavior === 'replace_label'
    ? 'Loading…'
    : action.label;

  const variant = getVariant(action.actionType);

  return (
    <View style={fullWidth ? styles.fullWidth : undefined}>
      <Button
        variant={variant}
        size={size}
        onPress={onPress}
        disabled={disabled}
        loading={isLoading && action.loadingBehavior === 'spinner'}
        style={fullWidth ? styles.fullWidth : undefined}
      >
        {label}
      </Button>
      {!action.isEnabled && action.reasonCode && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {getDisabledHint(action.reasonCode)}
        </Text>
      )}
    </View>
  );
}

function getVariant(actionType: HuntAction['actionType']): 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' {
  switch (actionType) {
    case 'join_hunt':
    case 'start_hunt':
    case 'accept_invitation':
      return 'primary';
    case 'continue_hunt':
      return 'primary';
    case 'view_completion':
    case 'view_hunt':
      return 'outline';
    case 'full':
    case 'cancelled':
    case 'expired':
    case 'upcoming':
    case 'unavailable':
    case 'invitation_required':
      return 'ghost';
    default:
      return 'secondary';
  }
}

function getDisabledHint(reasonCode: string | null): string {
  if (!reasonCode) return '';
  switch (reasonCode) {
    case 'HUNT_FULL':         return 'This hunt has no available spots.';
    case 'HUNT_CANCELLED':    return 'This hunt has been cancelled.';
    case 'HUNT_EXPIRED':      return 'This hunt has ended.';
    case 'HUNT_PAUSED':       return 'This hunt is temporarily paused.';
    case 'HUNT_UPCOMING':     return 'This hunt is not yet open for joining.';
    case 'INVITATION_REQUIRED': return 'An invitation is required to join.';
    case 'NOT_AUTHENTICATED': return 'Sign in to join.';
    case 'ALREADY_COMPLETED': return 'You have already completed this hunt.';
    default: return '';
  }
}

const styles = StyleSheet.create({
  fullWidth: { flex: 1 },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing[1],
    textAlign: 'center',
  },
});
