/**
 * Quest — Profile tab
 *
 * Shared player profile. Hosts the progression overview (achievements,
 * stats, active title, pinned badge) and navigation into subsections.
 *
 * Social entry points added in Prompt 16:
 * - Friends
 * - Friend Requests
 * - Find People
 * - Privacy (social settings)
 *
 * Settings, achievements, titles, badges, and statistics all live
 * beneath this screen — not in separate bottom tabs.
 */

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAppStore } from '@/lib/store';
import { useProgressOverview } from '@/features/progression/hooks/useProgressOverview';
import { useReceivedFriendRequests } from '@/features/social/hooks/useReceivedFriendRequests';
import { useFriends } from '@/features/social/hooks/useFriends';
import ProgressOverviewCard from '@/components/progression/ProgressOverviewCard';

const WORLDS_PURPLE = '#7C3AED';
const QUEST_COLOR   = '#F97316';

interface ProfileLinkProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  sublabel?: string;
  badge?: number;
  onPress: () => void;
  color?: string;
}

function ProfileLink({ icon, label, sublabel, badge, onPress, color }: ProfileLinkProps) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.link,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label + (sublabel ? `: ${sublabel}` : '') + (badge ? `, ${badge} pending` : '')}
    >
      <View style={[styles.linkIcon, { backgroundColor: (color ?? colors.muted) + '18' }]}>
        <Feather name={icon} size={18} color={color ?? colors.mutedForeground} />
      </View>
      <View style={styles.linkBody}>
        <Text style={[styles.linkLabel, { color: colors.foreground }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.linkSublabel, { color: colors.mutedForeground }]}>{sublabel}</Text>
        )}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function QuestProfileScreen() {
  const colors   = useColors();
  const { user, signOut } = useAuth();
  const unreadCount = useAppStore((s) => s.unreadCount);
  const overview = useProgressOverview();
  const received = useReceivedFriendRequests();
  const friends  = useFriends();

  const displayName = (user as any)?.user_metadata?.display_name ?? 'Explorer';
  const username    = (user as any)?.user_metadata?.username;
  const pendingCount = received.data?.length ?? 0;
  const friendsCount = friends.data?.length;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Player identity */}
      <View style={[styles.avatarBlock, { backgroundColor: QUEST_COLOR + '10', borderColor: QUEST_COLOR + '25' }]}>
        <View style={[styles.avatarCircle, { backgroundColor: QUEST_COLOR + '20' }]}>
          <Text style={[styles.avatarInitial, { color: QUEST_COLOR }]}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityBlock}>
          <Text style={[styles.displayName, { color: colors.foreground }]}>{displayName}</Text>
          {username && (
            <Text style={[styles.username, { color: colors.mutedForeground }]}>@{username}</Text>
          )}
          {overview.data?.activeTitleName && (
            <View style={[styles.titleBadge, { backgroundColor: WORLDS_PURPLE + '15' }]}>
              <Feather name="tag" size={11} color={WORLDS_PURPLE} />
              <Text style={[styles.titleBadgeLabel, { color: WORLDS_PURPLE }]}>
                {overview.data.activeTitleName}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progression overview */}
      <ProgressOverviewCard overview={overview.data ?? {
        activeTitleName: null, activeTitleSlug: null,
        pinnedBadgeName: null, pinnedBadgeIcon: null,
        achievementsCount: 0, combinedPoints: 0, totalActivities: 0,
      }} isLoading={overview.isLoading} />

      {/* Progress links */}
      <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Progress</Text>
      <ProfileLink
        icon="award"
        label="Achievements"
        sublabel={overview.data ? `${overview.data.achievementsCount} unlocked` : undefined}
        onPress={() => router.push('/profile-achievements')}
        color={WORLDS_PURPLE}
      />

      {/* Social links */}
      <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Social</Text>
      <ProfileLink
        icon="users"
        label="Friends"
        sublabel={friendsCount !== undefined ? `${friendsCount} connected` : undefined}
        onPress={() => router.push('/friends')}
        color={colors.primary}
      />
      <ProfileLink
        icon="user-plus"
        label="Friend Requests"
        sublabel="Received &amp; sent"
        badge={pendingCount}
        onPress={() => router.push('/friend-requests')}
        color={colors.primary}
      />
      <ProfileLink
        icon="search"
        label="Find People"
        sublabel="Search by username"
        onPress={() => router.push('/find-people')}
        color={colors.primary}
      />

      {/* Account links */}
      <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Account</Text>
      <ProfileLink
        icon="shield"
        label="Privacy"
        sublabel="Profile, discovery, connections"
        onPress={() => router.push('/social-privacy')}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="bell"
        label="Notifications"
        sublabel="Updates, invitations, and progress"
        badge={unreadCount}
        onPress={() => router.push('/notifications')}
        color={colors.primary}
      />
      <ProfileLink
        icon="refresh-cw"
        label="Offline & Sync"
        sublabel="Connection and saved changes"
        onPress={() => router.push('/offline-sync')}
        color={colors.primary}
      />
      <ProfileLink
        icon="settings"
        label="Settings"
        sublabel="Notifications, account"
         onPress={() => router.push('/settings')}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="help-circle"
        label="Help &amp; Support"
         onPress={() => router.push('/help')}
        color={colors.mutedForeground}
      />
       <ProfileLink
        icon="file-text"
        label="Terms &amp; Privacy"
        onPress={() => Alert.alert('Terms & Privacy', 'Review the Worlds terms and privacy policy from the account help area.')}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="log-out"
        label="Sign Out"
        onPress={() => Alert.alert('Sign out?', 'You can sign back in anytime.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => { void signOut(); } },
        ])}
        color={colors.destructive}
      />

      <View style={{ height: spacing[6] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  avatarBlock: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: 1,
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: 26 },
  identityBlock: { flex: 1, gap: spacing[1] },
  displayName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full,
  },
  titleBadgeLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  groupLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[1],
  },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  linkBody: { flex: 1, gap: 2 },
  linkLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  linkSublabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.xs },
});
