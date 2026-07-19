/**
 * WithdrawalConfirmation — Worlds (Prompt 13)
 *
 * Modal confirmation before withdrawing from a Hunt.
 * Clearly explains consequences. Withdrawal is server-authoritative.
 *
 * Rules:
 * - Withdrawal does NOT delete participation history
 * - Must NOT award points
 * - Requires explicit second confirmation
 * - "Keep Playing" is the safe default
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface WithdrawalConfirmationProps {
  visible:       boolean;
  huntTitle:     string;
  isWithdrawing: boolean;
  errorMessage:  string | null;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function WithdrawalConfirmation({
  visible,
  huntTitle,
  isWithdrawing,
  errorMessage,
  onConfirm,
  onCancel,
}: WithdrawalConfirmationProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={isWithdrawing ? undefined : onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={e => e.stopPropagation()}>

          <View style={[styles.iconWrap, { backgroundColor: '#FEE2E2' }]}>
            <Feather name="log-out" size={24} color="#EF4444" />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Withdraw from Hunt?</Text>
          <Text style={[styles.huntName, { color: colors.mutedForeground }]}>{huntTitle}</Text>

          {/* Consequences */}
          <View style={[styles.consequences, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <ConsequenceRow icon="clock" text="Your hunt progress will be preserved in your history." colors={colors} />
            <ConsequenceRow icon="award" text="Completion points will not be awarded." colors={colors} />
            <ConsequenceRow icon="repeat" text="Rejoining depends on the hunt rules and capacity." colors={colors} />
            <ConsequenceRow icon="file-text" text="Submitted proof may remain under review." colors={colors} />
          </View>

          {errorMessage && (
            <View style={[styles.error, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btns}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isWithdrawing}
              style={[styles.btn, styles.keepBtn, { borderColor: colors.border }]}
              accessibilityLabel="Keep playing"
            >
              <Text style={[styles.keepBtnText, { color: colors.foreground }]}>Keep Playing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isWithdrawing}
              style={[styles.btn, styles.withdrawBtn, { opacity: isWithdrawing ? 0.7 : 1 }]}
              accessibilityLabel="Confirm withdrawal from hunt"
            >
              {isWithdrawing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ConsequenceRow({ icon, text, colors }: { icon: string; text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.consequenceRow}>
      <Feather name={icon as any} size={14} color={colors.mutedForeground} />
      <Text style={[styles.consequenceText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing[6],
  },
  card: {
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[5],
    gap: spacing[4], width: '100%', maxWidth: 360, alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  huntName: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
  consequences: {
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[4],
    gap: spacing[2], width: '100%',
  },
  consequenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  consequenceText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 18 },
  error: {
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3], width: '100%',
  },
  errorText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: '#991B1B', textAlign: 'center' },
  btns: { flexDirection: 'row', gap: spacing[3], width: '100%' },
  btn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.xl, alignItems: 'center' },
  keepBtn: { borderWidth: 1 },
  keepBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  withdrawBtn: { backgroundColor: '#EF4444' },
  withdrawBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base, color: '#fff' },
});
