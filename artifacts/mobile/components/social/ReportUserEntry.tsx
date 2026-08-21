/**
 * ReportUserEntry — "Report" link + reason-selection sheet.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@/features/social/types/social.types';
import { useSubmitUserReport } from '@/features/social/hooks/useSubmitUserReport';

interface ReportUserEntryProps {
  targetUsername: string;
  displayName: string;
}

export function ReportUserEntry({ targetUsername, displayName }: ReportUserEntryProps) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const report = useSubmitUserReport();

  async function handleSubmit() {
    if (!selected) return;
    await report.mutateAsync({ targetUsername, reason: selected });
    setSubmitted(true);
  }

  return (
    <>
      <Pressable
        style={styles.entry}
        onPress={() => { setVisible(true); setSubmitted(false); setSelected(null); }}
        accessibilityRole="button"
        accessibilityLabel="Report this user"
      >
        <Feather name="flag" size={14} color={colors.mutedForeground} />
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Report</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)} accessibilityViewIsModal>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {submitted ? (
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>Report submitted</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  Thank you. We will review your report privately.
                </Text>
                <Pressable style={[styles.submitBtn, { backgroundColor: colors.muted }]} onPress={() => setVisible(false)}>
                  <Text style={[styles.submitText, { color: colors.foreground }]}>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>Report {displayName}</Text>
                <ScrollView style={styles.reasons} showsVerticalScrollIndicator={false}>
                  {REPORT_REASONS.map(r => (
                    <Pressable
                      key={r}
                      style={[styles.reasonRow, { borderColor: colors.border, backgroundColor: selected===r ? colors.primary+'18' : colors.muted }]}
                      onPress={() => setSelected(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selected === r }}
                    >
                      <View style={[styles.radio, { borderColor: selected===r ? colors.primary : colors.border, backgroundColor: selected===r ? colors.primary : 'transparent' }]} />
                      <Text style={[styles.reasonLabel, { color: colors.foreground }]}>{REPORT_REASON_LABELS[r]}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.actions}>
                  <Pressable style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => setVisible(false)}>
                    <Text style={[styles.actionText, { color: colors.foreground }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: selected ? colors.primary : colors.muted, opacity: selected ? 1 : 0.5 }]}
                    onPress={handleSubmit}
                    disabled={!selected || report.isPending}
                  >
                    <Text style={[styles.actionText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>Submit</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, padding: spacing[5], gap: spacing[3], maxHeight: '80%',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  reasons: { maxHeight: 280 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing[2],
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  reasonLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing[3] },
  actionBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  actionText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  submitBtn: { paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  submitText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
