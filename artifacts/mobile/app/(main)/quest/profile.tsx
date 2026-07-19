/**
 * Quest — Profile tab
 *
 * Shared player profile. Hosts the progression overview (achievements,
 * stats, active title, pinned badge) and navigation into subsections.
 *
 * Settings, achievements, titles, badges, and statistics all live
 * beneath this screen — not in separate bottom tabs.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProgressOverview } from '@/features/progression/hooks/useProgressOverview';
import ProgressOverviewCard from '@/components/progression/ProgressOverviewCard';

const WORLDS_PURPLE = '#7C3AED';
const QUEST_COLOR   = '#F97316';

interface ProfileLinkProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  sublabel?: string;
  onPress: () => void;
  color?: string;
}

function ProfileLink({ icon, label, sublabel, onPress, color }: ProfileLinkProps) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.link,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label + (sublabel ? `: ${sublabel}` : '')}
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
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function QuestProfileScreen() {
  const colors   = useColors();
  const { user } = useAuth();
  const overview = useProgressOverview();

  const displayName = (user as any)?.user_metadata?.display_name ?? 'Explorer';
  const username    = (user as any)?.user_metadata?.username;

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

      {/* Navigation links */}
      <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Progress</Text>

      <ProfileLink
        icon="award"
        label="Achievements"
        sublabel={overview.data ? `${overview.data.achievementsCount} unlocked` : undefined}
        onPress={() => router.push('/profile-achievements')}
        color={WORLDS_PURPLE}
      />

      <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Account</Text>

      <ProfileLink
        icon="settings"
        label="Settings"
        sublabel="Notifications, privacy, account"
        onPress={() => {}}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="help-circle"
        label="Help & Support"
        onPress={() => {}}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="file-text"
        label="Terms & Privacy"
        onPress={() => {}}
        color={colors.mutedForeground}
      />
      <ProfileLink
        icon="log-out"
        label="Sign Out"
        onPress={() => {}}
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
});
