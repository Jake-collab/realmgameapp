/**
 * Hunt Completion Screen — Worlds (Prompt 13)
 *
 * Shown after a successful hunt completion.
 * Fetches the active hunt data for stats and displays HuntCompletionSummary.
 *
 * This screen is a destination — always routes here from hunt-active
 * after completeHunt() returns success. Not accessible directly from nav.
 *
 * Rules:
 * - Points shown only after confirmed server completion
 * - Never shows points before completion is confirmed
 * - No raw user data or private participant info
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useActiveHunt } from '@/features/hunts/hooks/useActiveHunt';
import { useColors } from '@/hooks/useColors';

import { HuntCompletionSummary } from '@/components/active-hunt/HuntCompletionSummary';
import { HuntStatusState }       from '@/components/active-hunt/HuntStatusState';
import { ActiveHuntSkeleton }    from '@/components/active-hunt/ActiveHuntSkeleton';

export default function HuntCompletionScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const { user } = useAuth();

  const { data: hunt, isLoading } = useActiveHunt({
    participationId: participationId ?? null,
    userId: user?.id ?? null,
    pollingIntervalMs: 0, // no polling on completion screen
  });

  if (isLoading) {
    return <ActiveHuntSkeleton />;
  }

  if (!hunt) {
    return <HuntStatusState mode="not_found" />;
  }

  // Calculate stats
  const completedRequired = hunt.currentStops.filter(
    s => s.isRequired && s.progressStatus === 'completed'
  ).length;

  const completedOptional = hunt.currentStops.filter(
    s => !s.isRequired && s.progressStatus === 'completed'
  ).length;

  const awardedPoints = (hunt.rewardSnapshot as any)?.pointsReward ?? null;

  return (
    <HuntCompletionSummary
      result={{
        success:         true,
        participationId: participationId ?? '',
        awardedPoints:   typeof awardedPoints === 'number' ? awardedPoints : null,
        completedAt:     null,
        reasonCode:      null,
        userMessage:     "Congratulations! You've completed the hunt.",
      }}
      huntTitle={hunt.huntTitle}
      requiredCompleted={completedRequired}
      optionalCompleted={completedOptional}
      totalRequired={hunt.requiredStopCount}
      participationId={participationId ?? ''}
    />
  );
}
