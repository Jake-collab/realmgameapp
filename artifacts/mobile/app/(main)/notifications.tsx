import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/features/notifications/hooks';
import { openNotificationTarget } from '@/features/notifications/deepLinks';
import type { AppNotification } from '@/features/notifications/notification.types';

const icons: Record<AppNotification['category'], React.ComponentProps<typeof Feather>['name']> = {
  quest: 'compass', hunt: 'map', social: 'users', progress: 'award', moderation: 'shield', account: 'lock', system: 'info',
};

function sectionLabel(date: string) {
  const day = new Date(date).toDateString();
  return day === new Date().toDateString() ? 'Today' : 'Earlier';
}

export default function NotificationsScreen() {
  const colors = useColors();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const sections = useMemo(() => {
    const grouped: Record<string, AppNotification[]> = { Today: [], Earlier: [] };
    (notifications.data ?? []).forEach(n => grouped[sectionLabel(n.created_at)].push(n));
    return Object.entries(grouped).flatMap(([title, data]) => data.length ? [{ title, data }] : []);
  }, [notifications.data]);

  const open = (item: AppNotification) => {
    if (!item.read_at) markRead.mutate(item.id);
    openNotificationTarget(router, item.deep_link);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={12}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <Pressable onPress={() => markAll.mutate()} disabled={!notifications.unreadCount} accessibilityRole="button">
          <Text style={[styles.markAll, { color: notifications.unreadCount ? colors.primary : colors.mutedForeground }]}>Mark all read</Text>
        </Pressable>
      </View>
      {notifications.isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <FlatList
          data={sections}
          keyExtractor={item => item.title}
          contentContainerStyle={styles.content}
          ListEmptyComponent={<View style={styles.empty}><Feather name="bell-off" size={28} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>You’re all caught up</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Important Quest, Hunt, and account updates will appear here.</Text></View>}
          renderItem={({ item: section }) => <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>{section.data.map(item => (
            <Pressable key={item.id} onPress={() => open(item)} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.icon, { backgroundColor: item.read_at ? colors.muted : colors.primary + '18' }]}><Feather name={icons[item.category]} size={17} color={item.read_at ? colors.mutedForeground : colors.primary} /></View>
              <View style={styles.copy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{item.body}</Text><Text style={[styles.time, { color: colors.mutedForeground }]}>{new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>
              {!item.read_at && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          ))}</View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[5], borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg }, markAll: { fontFamily: fontFamily.medium, fontSize: fontSize.xs }, content: { padding: spacing[5], paddingBottom: spacing[12] },
  loader: { marginTop: spacing[8] }, section: { gap: spacing[2], marginBottom: spacing[5] }, sectionTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth }, icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 }, rowTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }, body: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 19 }, time: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 2 }, dot: { width: 8, height: 8, borderRadius: 4, marginTop: spacing[1] },
  empty: { alignItems: 'center', gap: spacing[2], padding: spacing[12] }, emptyTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md }, emptyBody: { textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
});