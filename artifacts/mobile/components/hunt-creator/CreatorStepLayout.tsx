import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing, radius } from '@/constants/spacing';
import type { CreatorStep, CreatorSaveState } from '@/features/hunts/types/creator.types';

const STEPS: { key: CreatorStep; label: string }[] = [
  { key:'details', label:'Details' }, { key:'privacy', label:'Plan' }, { key:'start', label:'Start' },
  { key:'stops', label:'Stops' }, { key:'invite', label:'Invite' }, { key:'preview', label:'Preview' }, { key:'review', label:'Review' },
];
export function CreatorStepLayout({ step, draftId, saveState, children }: {
  step: CreatorStep; draftId: string; saveState?: CreatorSaveState; children: React.ReactNode;
}) {
  const colors = useColors();
  const index = STEPS.findIndex(s => s.key === step);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={colors.foreground} /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.step, { color: colors.primary }]} accessibilityLiveRegion="polite">Step {index + 1} of 7</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{STEPS[index]?.label}</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(main)/hunt/my-hunts')} accessibilityLabel="Save and exit">
          <Text style={[styles.exit, { color: colors.primary }]}>Exit</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.progress, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((index + 1) / 7) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.saveBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
         <Feather name={saveState === 'saved' || saveState === 'saved_local' ? 'check' : saveState === 'saving' ? 'upload-cloud' : saveState === 'unsynced' ? 'cloud-off' : 'edit-3'} size={14} color={saveState === 'unsynced' ? colors.destructive : colors.mutedForeground} />
        <Text style={[styles.saveText, { color: saveState === 'unsynced' ? colors.destructive : colors.mutedForeground }]}>
           {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'saved_local' ? 'Saved on this device — syncs when online' : saveState === 'unsynced' ? 'Changes not synced — retry when online' : 'Changes save automatically'}
        </Text>
      </View>
    </View>
  );
}
export function CreatorNext({ label = 'Continue', onPress, disabled = false }: { label?: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.next, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}><Text style={styles.nextText}>{label}</Text><Feather name="arrow-right" size={17} color={colors.primaryForeground} /></TouchableOpacity>;
}
export function SectionIntro({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  return <View style={styles.intro}><Text style={[styles.introTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.introBody, { color: colors.mutedForeground }]}>{body}</Text></View>;
}
export const creatorStyles = StyleSheet.create({
  field: { marginBottom: spacing[4] }, label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, marginBottom: spacing[1] },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: spacing[1] },
});
const styles = StyleSheet.create({
  screen:{ flex:1 }, header:{ minHeight:64, paddingHorizontal:spacing[4], paddingTop:spacing[3], flexDirection:'row', alignItems:'center', borderBottomWidth:StyleSheet.hairlineWidth },
  headerCenter:{ flex:1, marginLeft:spacing[3] }, step:{ fontFamily:fontFamily.semiBold, fontSize:fontSize.xs }, title:{ fontFamily:fontFamily.bold, fontSize:fontSize.md },
  exit:{ fontFamily:fontFamily.semiBold, fontSize:fontSize.sm }, progress:{ height:3 }, progressFill:{ height:3 }, content:{ padding:spacing[5], paddingBottom:spacing[8] },
  saveBar:{ minHeight:38, paddingHorizontal:spacing[4], flexDirection:'row', alignItems:'center', gap:spacing[2], borderTopWidth:StyleSheet.hairlineWidth },
  saveText:{ fontFamily:fontFamily.regular, fontSize:fontSize.xs }, intro:{ marginBottom:spacing[5] }, introTitle:{ fontFamily:fontFamily.bold, fontSize:fontSize.lg, marginBottom:spacing[2] }, introBody:{ fontFamily:fontFamily.regular, fontSize:fontSize.base, lineHeight:22 },
  next:{ minHeight:52, borderRadius:radius.md, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:spacing[2], marginTop:spacing[2] }, nextText:{ color:'#fff', fontFamily:fontFamily.bold, fontSize:fontSize.base },
});