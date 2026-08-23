import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useSyncStatus } from '@/features/offline/hooks/useOffline';

const labels: Record<string, string> = {
  pending: 'Waiting to sync', waiting_dependency: 'Waiting for another change', syncing: 'Syncing', failed_retryable: 'Waiting to retry', needs_attention: 'Needs your attention',
};

export default function OfflineSyncScreen() {
  const colors = useColors();
  const sync = useSyncStatus();
  const connectionCopy = sync.state === 'offline' ? "You're offline. Some changes will sync when your connection returns." : sync.state === 'recovering' ? 'Reconnecting…' : sync.state === 'limited' ? 'Connection is limited. We’ll retry safely.' : sync.state === 'online' ? 'Connected' : 'Connection status is unknown.';
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>Offline & Sync</Text><View style={{ width: 22 }} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.statusIcon, { backgroundColor: sync.isOnline ? colors.primary + '18' : colors.muted }]}><Feather name={sync.isOnline ? 'wifi' : 'wifi-off'} size={20} color={sync.isOnline ? colors.primary : colors.mutedForeground} /></View><View style={styles.flex}><Text style={[styles.statusTitle, { color: colors.foreground }]}>{connectionCopy}</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>Offline mode preserves safe drafts and evidence. The server still decides completion, points, location, and publication.</Text></View></View>
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}><View><Text style={[styles.metric, { color: colors.foreground }]}>{sync.pendingCount}</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>Changes waiting</Text></View><View><Text style={[styles.metric, { color: colors.foreground }]}>{sync.attentionCount}</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>Need attention</Text></View><View><Text style={[styles.metric, { color: colors.foreground }]}>{sync.isSyncing ? '…' : sync.lastSyncAt ? 'Ready' : '—'}</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>Last sync</Text></View></View>
      <Pressable onPress={() => void sync.syncNow()} disabled={!sync.isOnline || sync.isSyncing} style={[styles.button, { backgroundColor: sync.isOnline ? colors.primary : colors.muted }]}>{sync.isSyncing ? <ActivityIndicator color={colors.primaryForeground} /> : <><Feather name="refresh-cw" size={16} color={sync.isOnline ? colors.primaryForeground : colors.mutedForeground} /><Text style={[styles.buttonText, { color: sync.isOnline ? colors.primaryForeground : colors.mutedForeground }]}>Sync Now</Text></>}</Pressable>
      {sync.items.length > 0 && <View style={styles.list}>{sync.items.map(item => <View key={item.id} style={[styles.item, { borderBottomColor: colors.border }]}><View style={styles.flex}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.entityType === 'proof' ? 'Quest proof' : item.entityType === 'hunt_draft' ? 'Custom Hunt draft' : 'Saved change'}</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>{labels[item.status] ?? 'Waiting to sync'}</Text></View><Feather name={item.status === 'needs_attention' ? 'alert-circle' : 'clock'} size={17} color={item.status === 'needs_attention' ? colors.destructive : colors.mutedForeground} /></View>)}</View>}
      {!sync.items.length && <View style={styles.empty}><Feather name="check-circle" size={26} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>All changes are synced</Text><Text style={[styles.caption, { color: colors.mutedForeground }]}>Safe drafts and approved low-risk changes will appear here when they are waiting.</Text></View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[5], borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] }, statusCard: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth }, statusIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' }, flex: { flex: 1 }, statusTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, marginBottom: 3 }, caption: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 }, summary: { flexDirection: 'row', justifyContent: 'space-around', padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth }, metric: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' }, button: { minHeight: 48, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] }, buttonText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }, list: { borderTopWidth: StyleSheet.hairlineWidth }, item: { paddingVertical: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: spacing[3] }, itemTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.sm }, empty: { alignItems: 'center', padding: spacing[10], gap: spacing[2] }, emptyTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md },
});