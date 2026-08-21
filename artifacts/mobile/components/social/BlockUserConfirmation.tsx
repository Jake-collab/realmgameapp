/**
 * BlockUserConfirmation — modal before blocking a user.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface BlockUserConfirmationProps {
  visible: boolean;
  displayName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CONSEQUENCES = [
  'They will be removed from your friends.',
  'Pending friend requests will be cancelled.',
  'You will not be able to send each other Hunt invitations.',
  'Their profile will no longer appear in your search results.',
  'They will not receive a notification that you blocked them.',
];

export function BlockUserConfirmation({ visible, displayName, onConfirm, onCancel, isLoading }: BlockUserConfirmationProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Block {displayName}?</Text>
          {CONSEQUENCES.map((c, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.bullet, { color: colors.mutedForeground }]}>•</Text>
              <Text style={[styles.consequence, { color: colors.mutedForeground }]}>{c}</Text>
            </View>
          ))}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.muted }]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.destructive }]}
              onPress={onConfirm}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Block user"
            >
              <Text style={[styles.btnText, { color: colors.destructiveForeground }]}>Block User</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: spacing[4] },
  sheet: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[5], gap: spacing[3],
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  item: { flexDirection: 'row', gap: spacing[2] },
  bullet: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  consequence: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
