/**
 * Social Privacy Settings Screen — Worlds (Prompt 16)
 *
 * Grouped controls for profile visibility, discoverability, connections.
 * Each section has a clear description so users understand what each setting does.
 * Settings are server-backed via update_social_privacy_settings RPC.
 */

import React from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useSocialPrivacySettings } from '@/features/social/hooks/useSocialPrivacySettings';
import { useUpdateSocialPrivacySettings } from '@/features/social/hooks/useUpdateSocialPrivacySettings';
import { SocialPrivacyControl } from '@/components/social/SocialPrivacyControl';
import {
  PROFILE_VISIBILITY_LABELS,
  PROFILE_VISIBILITY_DESCRIPTIONS,
} from '@/features/social/constants/social.constants';
import type { SocialPrivacySettingsUpdate } from '@/features/social/types/social.types';
import { useState } from 'react';

export default function SocialPrivacyScreen() {
  const colors = useColors();
  const { data: settings, isLoading } = useSocialPrivacySettings();
  const update = useUpdateSocialPrivacySettings();
  const [visibilityPickerVisible, setVisibilityPickerVisible] = useState(false);

  function save(patch: SocialPrivacySettingsUpdate) {
    update.mutate(patch);
  }

  if (isLoading || !settings) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader />

      {/* ── Profile ────────────────────────────────────────────── */}
      <SectionLabel label="Profile" />
      <SocialPrivacyControl
        kind="picker"
        label="Profile visibility"
        description="Controls who can open your profile."
        currentLabel={PROFILE_VISIBILITY_LABELS[settings.profileVisibility] ?? settings.profileVisibility}
        onPress={() => setVisibilityPickerVisible(true)}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show bio"
        description="Display your bio on your public profile."
        value={settings.showBio}
        onChange={v => save({ showBio: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show active title"
        value={settings.showActiveTitle}
        onChange={v => save({ showActiveTitle: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show badges"
        value={settings.showBadges}
        onChange={v => save({ showBadges: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show achievements"
        value={settings.showAchievements}
        onChange={v => save({ showAchievements: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show statistics"
        description="Quest completions, Hunt completions, and points."
        value={settings.showStatistics}
        onChange={v => save({ showStatistics: v })}
      />

      {/* ── Discovery ──────────────────────────────────────────── */}
      <SectionLabel label="Discovery" />
      <InfoRow text="Discoverability controls whether people can find you through search. It is separate from your profile visibility." />
      <SocialPrivacyControl
        kind="toggle"
        label="Find me by username"
        description="Allow others to search for you by your username."
        value={settings.discoverableByUsername}
        onChange={v => save({ discoverableByUsername: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Find me by display name"
        description="Allow others to search for you by your display name."
        value={settings.discoverableByDisplayName}
        onChange={v => save({ discoverableByDisplayName: v })}
      />
      <SocialPrivacyControl
        kind="toggle"
        label="Show mutual-friend count"
        description="Let others see how many friends you have in common."
        value={settings.showMutualFriendCount}
        onChange={v => save({ showMutualFriendCount: v })}
      />

      {/* ── Connections ────────────────────────────────────────── */}
      <SectionLabel label="Connections" />
      <SocialPrivacyControl
        kind="toggle"
        label="Allow friend requests"
        description="Let others send you friend requests."
        value={settings.allowFriendRequests}
        onChange={v => save({ allowFriendRequests: v })}
      />
      <SocialPrivacyControl
        kind="picker"
        label="Allow Hunt invitations from"
        description="Who may invite you to join Hunts."
        currentLabel={settings.allowHuntInvitationsFrom === 'friends' ? 'Friends' : 'Nobody'}
        onPress={() => save({ allowHuntInvitationsFrom: settings.allowHuntInvitationsFrom === 'friends' ? 'nobody' : 'friends' })}
      />

      {/* ── Safety ─────────────────────────────────────────────── */}
      <SectionLabel label="Safety" />
      <Pressable
        style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push('/blocked-users')}
        accessibilityRole="button"
      >
        <Feather name="slash" size={16} color={colors.foreground} />
        <Text style={[styles.navLabel, { color: colors.foreground }]}>Blocked Users</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>
      <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Reports are always submitted privately. The reported user is never notified.
        </Text>
      </View>

      <View style={{ height: spacing[8] }} />

      {/* Profile visibility picker */}
      <Modal visible={visibilityPickerVisible} transparent animationType="slide" onRequestClose={() => setVisibilityPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Profile Visibility</Text>
            {(['public', 'friends_only', 'private'] as const).map(v => (
              <Pressable
                key={v}
                style={[styles.pickerOption, { backgroundColor: settings.profileVisibility===v ? colors.primary+'18' : colors.muted }]}
                onPress={() => { save({ profileVisibility: v }); setVisibilityPickerVisible(false); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.profileVisibility === v }}
              >
                <View style={styles.pickerOptionContent}>
                  <Text style={[styles.pickerOptionLabel, { color: colors.foreground }]}>{PROFILE_VISIBILITY_LABELS[v]}</Text>
                  <Text style={[styles.pickerOptionDesc, { color: colors.mutedForeground }]}>{PROFILE_VISIBILITY_DESCRIPTIONS[v]}</Text>
                </View>
                {settings.profileVisibility === v && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
            <Pressable style={[styles.pickerCancel, { backgroundColor: colors.muted }]} onPress={() => setVisibilityPickerVisible(false)}>
              <Text style={[styles.pickerCancelText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ScreenHeader() {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy</Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>;
}

function InfoRow({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing[5], gap: spacing[3], paddingBottom: spacing[12] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[4],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[2],
  },
  infoBox: { padding: spacing[3], borderRadius: radius.lg },
  infoText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  navLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, padding: spacing[5], gap: spacing[3],
  },
  pickerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  pickerOption: { padding: spacing[4], borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center' },
  pickerOptionContent: { flex: 1, gap: 2 },
  pickerOptionLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  pickerOptionDesc: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  pickerCancel: { padding: spacing[4], borderRadius: radius.lg, alignItems: 'center', marginTop: spacing[2] },
  pickerCancelText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
