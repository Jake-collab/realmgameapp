import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { spacing, radius } from '@/constants/spacing';
import { fontFamily, fontSize } from '@/constants/typography';

const FAQ = [
  ['How do I start a Hunt?', 'Open My Hunts, choose Create Hunt, and save your adventure as you work through the creator steps.'],
  ['Why is my Hunt not public yet?', 'Every creator Hunt is reviewed before publication. You can continue editing drafts and see review status from My Hunts.'],
  ['How are locations handled?', 'Player previews use approximate public locations. Exact validation geometry and private answers are never shown in previews.'],
  ['How do I report a safety issue?', 'Use the support link below and include the Hunt title, what happened, and the location label. Do not include private account credentials.'],
] as const;

export default function HelpScreen() {
  const colors = useColors();
  const handleContactSupport = async () => {
    const supportUrl = 'mailto:support@worlds.app';
    try {
      if (!(await Linking.canOpenURL(supportUrl))) {
        throw new Error('Email support is unavailable on this device.');
      }
      await Linking.openURL(supportUrl);
    } catch {
      Alert.alert(
        'Support unavailable',
        'Email support is not available on this device. Please check your connection or contact your local support team.'
      );
    }
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>Help & Support</Text><View style={{ width: 22 }} /></View>
    <Text style={[styles.intro, { color: colors.mutedForeground }]}>Quick answers for exploring, creating, and staying safe in Worlds.</Text>
    {FAQ.map(([question, answer]) => <View key={question} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.question, { color: colors.foreground }]}>{question}</Text><Text style={[styles.answer, { color: colors.mutedForeground }]}>{answer}</Text></View>)}
    <Pressable onPress={() => void handleContactSupport()} style={[styles.support, { backgroundColor: colors.primary }]} accessibilityRole="button"><Feather name="mail" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.semiBold }}>Contact support</Text></Pressable>
    <Text style={[styles.note, { color: colors.mutedForeground }]}>For urgent personal safety concerns, contact local emergency services first.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: spacing[5], gap: spacing[3], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing[3] },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  intro: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 23, marginBottom: spacing[2] },
  card: { padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, gap: spacing[2] },
  question: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  answer: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 21 },
  support: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing[2], padding: spacing[4], borderRadius: radius.md, marginTop: spacing[2] },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18, textAlign: 'center', marginTop: spacing[2] },
});