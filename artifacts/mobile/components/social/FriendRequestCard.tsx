/**
 * FriendRequestCard — received or sent request row.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { FriendRequestEntry } from '@/features/social/types/social.types';
import { SOCIAL_GREEN, SOCIAL_PURPLE } from '@/features/social/constants/social.constants';

interface ReceivedProps {
  kind: 'received';
  request: FriendRequestEntry;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile: () => void;
  isLoading?: boolean;
}
interface SentProps {
  kind: 'sent';
  request: FriendRequestEntry;
  onCancel: () => void;
  onViewProfile: () => void;
  isLoading?: boolean;
}

type FriendRequestCardProps = ReceivedProps | SentProps;

export function FriendRequestCard(props: FriendRequestCardProps) {
  const colors = useColors();
  const { request, onViewProfile, isLoading } = props;
  const initial = (request.displayName || request.username || '?').charAt(0).toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Identity row */}
      <Pressable style={styles.identityRow} onPress={onViewProfile} accessibilityRole="button">
        <View style={[styles.avatar, { backgroundColor: SOCIAL_PURPLE + '20' }]}>
          <Text style={[styles.initial, { color: SOCIAL_PURPLE }]}>{initial}</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{request.displayName}</Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>@{request.username}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(request.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </Pressable>

      {/* Actions */}
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} style={{ alignSelf: 'center', marginTop: spacing[2] }} />
      ) : props.kind === 'received' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: SOCIAL_GREEN }]}
            onPress={props.onAccept}
            accessibilityRole="button"
            accessibilityLabel="Accept friend request"
          >
            <Text style={[styles.btnText, { color: '#FFF' }]}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.muted }]}
            onPress={props.onDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline friend request"
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>Decline</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={[styles.pendingBadge, { backgroundColor: SOCIAL_PURPLE + '15' }]}>
            <Feather name="clock" size={11} color={SOCIAL_PURPLE} />
            <Text style={[styles.pendingLabel, { color: SOCIAL_PURPLE }]}>Pending</Text>
          </View>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.muted }]}
            onPress={props.onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel friend request"
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel Request</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fontFamily.bold, fontSize: 18 },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  actions: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  btn: {
    flex: 1, paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: radius.lg, alignItems: 'center', minHeight: 36, justifyContent: 'center',
  },
  btnText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.full,
  },
  pendingLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
});
