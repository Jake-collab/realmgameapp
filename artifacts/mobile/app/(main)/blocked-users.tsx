/**
 * Blocked Users Screen — Worlds (Prompt 16)
 *
 * Shows the current user's active blocks.
 * Unblocking does NOT restore friendship or cancelled requests.
 */

import React, { useState } from 'react';
import {
  FlatList, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useBlockedUsers } from '@/features/social/hooks/useBlockedUsers';
import { useUnblockUser } from '@/features/social/hooks/useUnblockUser';
import { BlockedUserRow } from '@/components/social/BlockedUserRow';
import { SocialEmptyState } from '@/components/social/SocialEmptyState';
import { SocialSkeleton } from '@/components/social/SocialSkeleton';
import type { BlockedUserEntry } from '@/features/social/types/social.types';

export default function BlockedUsersScreen() {
  const colors = useColors();
  const { data, isLoading, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();
  const [confirm, setConfirm] = useState<BlockedUserEntry | null>(null);

  function handleUnblockConfirm() {
    if (!confirm) return;
    unblock.mutate({ targetUsername: confirm.publicUserRef });
    setConfirm(null);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Blocked Users</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Info banner */}
      <View style={[styles.info, { backgroundColor: colors.muted }]}>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Unblocking someone does not restore your friendship or previous invitations.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <SocialSkeleton count={4} />
        </View>
      ) : !data || data.length === 0 ? (
        <SocialEmptyState variant="blocked_users" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={e => e.publicUserRef}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <BlockedUserRow
              entry={item}
              onUnblock={() => setConfirm(item)}
              isLoading={unblock.isPending}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Unblock confirmation */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Unblock {confirm?.displayName}?
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              They will be able to find you through search again, subject to your privacy settings.
              You can send them a new friend request.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setConfirm(null)}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleUnblockConfirm} disabled={unblock.isPending}>
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Unblock</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  info: { margin: spacing[5], marginBottom: spacing[3], padding: spacing[3], borderRadius: radius.lg },
  infoText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  listContent: { padding: spacing[5], paddingTop: spacing[2], gap: spacing[2] },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing[5] },
  modal: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: spacing[5], gap: spacing[3] },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  modalBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  modalActions: { flexDirection: 'row', gap: spacing[3] },
  modalBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  modalBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
