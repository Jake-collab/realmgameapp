import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { getAllInterests, getMyInterests, setMyInterests } from '@/services/profile/profile.service';
import type { InterestRow } from '@/lib/supabase/database.types';

export default function InterestsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void Promise.all([getAllInterests(), getMyInterests(user.id)])
      .then(([available, selected]) => {
        if (!cancelled) {
          setInterests(available);
          setSelectedIds(selected.map((interest) => interest.id));
        }
      })
      .catch(() => {
        if (!cancelled) Alert.alert('Interest Bubbles unavailable', 'Reconnect and try again. Your existing preferences have not changed.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await setMyInterests(user.id, selectedIds);
      Alert.alert('Preferences saved', 'Your Interest Bubbles will guide future Daily Quest assignments. Today’s assigned Daily stays the same.');
      router.back();
    } catch {
      Alert.alert('Could not save preferences', 'Nothing was changed. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <Feather name="chevron-left" size={22} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Profile</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.foreground }]}>Interest Bubbles</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>Choose the themes you want to explore. Changes guide future Daily Quest assignments; they do not reroll or change today’s Quest.</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <View style={styles.grid}>
        {interests.map((interest) => {
          const selected = selectedIds.includes(interest.id);
          return <Pressable key={interest.id} onPress={() => toggle(interest.id)} style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
            <Feather name={selected ? 'check' : 'plus'} size={15} color={selected ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.chipLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>{interest.name}</Text>
          </Pressable>;
        })}
      </View>}
      {!loading && <Pressable onPress={() => void save()} disabled={saving} style={[styles.save, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} accessibilityRole="button">
        <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Saving…' : 'Save preferences'}</Text>
      </Pressable>}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Assignments use the server’s UTC day and remain stable once selected.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[4] },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-start' },
  backText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'] },
  description: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 21 },
  loader: { marginTop: spacing[7] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  save: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing[4], marginTop: spacing[2] },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 17 },
});