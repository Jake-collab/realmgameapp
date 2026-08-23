import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { spacing, radius } from '@/constants/spacing';
import { fontFamily, fontSize } from '@/constants/typography';
import { useUserSettings, useUpdateUserSettings, defaultUserSettings } from '@/features/profile/hooks/useUserSettings';
import type { UserSettingsRow } from '@/lib/supabase/database.types';
import { usePushPermission } from '@/features/notifications/usePushPermission';

function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.rowText}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>{description && <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>}</View>
    <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.muted, true: colors.primary + '70' }} thumbColor={value ? colors.primary : colors.mutedForeground} accessibilityLabel={label} />
  </View>;
}

function ChoiceRow<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (value: T) => void }) {
  const colors = useColors();
  return <View style={[styles.choiceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><View style={styles.choices}>{options.map(option => <Pressable key={option} onPress={() => onChange(option)} accessibilityRole="radio" accessibilityState={{ selected: value === option }} style={[styles.choice, { backgroundColor: value === option ? colors.primary : colors.muted }]}><Text style={{ color: value === option ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.medium, fontSize: fontSize.sm }}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text></Pressable>)}</View></View>;
}

export default function SettingsScreen() {
  const colors = useColors(); const query = useUserSettings(); const update = useUpdateUserSettings();
  const push = usePushPermission();
  const settings: UserSettingsRow = query.data ?? defaultUserSettings;
  const save = (payload: Partial<UserSettingsRow>) => { if (!query.data) { Alert.alert('Settings unavailable', 'Connect your account to save settings.'); return; } update.mutate(payload); };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>Settings</Text><View style={{ width: 22 }} /></View>
    {query.isLoading && <ActivityIndicator color={colors.primary} />}
    {!query.data && !query.isLoading && <View style={[styles.info, { backgroundColor: colors.muted }]}><Text style={[styles.description, { color: colors.mutedForeground }]}>Settings are shown with safe defaults until your account connection is available.</Text></View>}
    <Text style={[styles.section, { color: colors.mutedForeground }]}>Notifications</Text>
    <View style={[styles.info, { backgroundColor: colors.muted }]}>
      <Text style={[styles.label, { color: colors.foreground }]}>Push notifications</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        {push.status === 'granted' || push.status === 'provisional' ? 'Enabled on this device.' : push.status === 'denied' ? 'Disabled by your device settings.' : 'Get timely updates about Quests, Hunts, and progress.'}
      </Text>
      {push.status === 'denied' ? <Pressable onPress={() => void push.openSettings()}><Text style={{ color: colors.primary, fontFamily: fontFamily.medium }}>Open Settings</Text></Pressable> : push.status === 'not_asked' ? <Pressable onPress={() => void push.request()}><Text style={{ color: colors.primary, fontFamily: fontFamily.medium }}>Enable Notifications</Text></Pressable> : null}
    </View>
    <ToggleRow label="Quest availability" value={settings.notify_quest_available} onChange={v => save({ notify_quest_available: v })} />
    <ToggleRow label="Monthly drops" value={settings.notify_monthly_drop} onChange={v => save({ notify_monthly_drop: v })} />
    <ToggleRow label="Hunt invitations" value={settings.notify_hunt_invitation} onChange={v => save({ notify_hunt_invitation: v })} />
    <ToggleRow label="Hunt updates" value={settings.notify_hunt_updates} onChange={v => save({ notify_hunt_updates: v })} />
    <ToggleRow label="Proof decisions" value={settings.notify_proof_decisions} onChange={v => save({ notify_proof_decisions: v })} />
    <ToggleRow label="Achievements" value={settings.notify_achievements} onChange={v => save({ notify_achievements: v })} />
    <Text style={[styles.section, { color: colors.mutedForeground }]}>Experience</Text>
    <ChoiceRow label="Theme" options={['system', 'light', 'dark'] as const} value={settings.theme_preference} onChange={v => save({ theme_preference: v })} />
    <ChoiceRow label="Units" options={['imperial', 'metric'] as const} value={settings.preferred_units} onChange={v => save({ preferred_units: v })} />
    <ToggleRow label="Reduce motion" description="Use fewer animations throughout the app." value={settings.reduce_motion} onChange={v => save({ reduce_motion: v })} />
    <ToggleRow label="Share location" description="Allow location-based Hunt features to use your position." value={settings.location_sharing_enabled} onChange={v => save({ location_sharing_enabled: v })} />
    {!!update.isError && <Text style={{ color: colors.destructive }}>Couldn't save that setting. Please try again.</Text>}
    {!!update.isPending && <Text style={{ color: colors.mutedForeground }}>Saving…</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: spacing[5], gap: spacing[3], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing[3] },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  section: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 3 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  description: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 },
  choiceBlock: { padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, gap: spacing[3] },
  choices: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  choice: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.md },
  info: { padding: spacing[3], borderRadius: radius.lg },
});