/**
 * Friend Requests Screen — Worlds (Prompt 16)
 *
 * Two internal sections: Received / Sent.
 * Not bottom tabs — segmented control within the screen.
 * Does NOT show declined or cancelled history.
 */

import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useReceivedFriendRequests } from '@/features/social/hooks/useReceivedFriendRequests';
import { useSentFriendRequests } from '@/features/social/hooks/useSentFriendRequests';
import { useAcceptFriendRequest } from '@/features/social/hooks/useAcceptFriendRequest';
import { useDeclineFriendRequest } from '@/features/social/hooks/useDeclineFriendRequest';
import { useCancelFriendRequest } from '@/features/social/hooks/useCancelFriendRequest';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { SocialEmptyState } from '@/components/social/SocialEmptyState';
import { SocialSkeleton } from '@/components/social/SocialSkeleton';

type Section = 'received' | 'sent';

export default function FriendRequestsScreen() {
  const colors = useColors();
  const [section, setSection] = useState<Section>('received');

  const received  = useReceivedFriendRequests();
  const sent      = useSentFriendRequests();
  const accept    = useAcceptFriendRequest();
  const decline   = useDeclineFriendRequest();
  const cancel    = useCancelFriendRequest();

  const receivedCount = received.data?.length ?? 0;
  const sentCount     = sent.data?.length ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Friend Requests</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Segmented control */}
      <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
        {(['received', 'sent'] as Section[]).map(s => (
          <Pressable
            key={s}
            style={[styles.segment, section === s && { backgroundColor: colors.card }]}
            onPress={() => setSection(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === s }}
            accessibilityLabel={s === 'received'
              ? `Received (${receivedCount})`
              : `Sent (${sentCount})`}
          >
            <Text style={[
              styles.segmentLabel,
              { color: section === s ? colors.foreground : colors.mutedForeground },
            ]}>
              {s === 'received' ? `Received${receivedCount > 0 ? ` (${receivedCount})` : ''}` : `Sent${sentCount > 0 ? ` (${sentCount})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {section === 'received' ? (
          received.isLoading ? (
            <SocialSkeleton count={3} />
          ) : !received.data || received.data.length === 0 ? (
            <SocialEmptyState variant="requests_received" />
          ) : (
            received.data.map(req => (
              <FriendRequestCard
                key={req.requestId}
                kind="received"
                request={req}
                isLoading={accept.isPending || decline.isPending}
                onAccept={() => accept.mutate({ requestId: req.requestId, requesterUsername: req.username })}
                onDecline={() => decline.mutate({ requestId: req.requestId, requesterUsername: req.username })}
                onViewProfile={() => router.push(`/public-profile/${req.username}`)}
              />
            ))
          )
        ) : (
          sent.isLoading ? (
            <SocialSkeleton count={3} />
          ) : !sent.data || sent.data.length === 0 ? (
            <SocialEmptyState variant="requests_sent" />
          ) : (
            sent.data.map(req => (
              <FriendRequestCard
                key={req.requestId}
                kind="sent"
                request={req}
                isLoading={cancel.isPending}
                onCancel={() => cancel.mutate({ requestId: req.requestId, recipientUsername: req.username })}
                onViewProfile={() => router.push(`/public-profile/${req.username}`)}
              />
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], paddingTop: spacing[12], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  segmented: {
    flexDirection: 'row', margin: spacing[5], borderRadius: radius.lg, padding: 3,
  },
  segment: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderRadius: radius.md,
  },
  segmentLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  content: { padding: spacing[5], paddingTop: spacing[2], gap: spacing[3] },
});
