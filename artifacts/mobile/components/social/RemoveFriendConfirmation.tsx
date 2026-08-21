/**
 * RemoveFriendConfirmation — modal before removing a friend.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface RemoveFriendConfirmationProps {
  visible: boolean;
  displayName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RemoveFriendConfirmation({ visible, displayName, onConfirm, onCancel, isLoading }: RemoveFriendConfirmationProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Remove {displayName} from your friends?</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You will no longer be connected. You can send a new friend request again later.
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.muted }]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Keep friend"
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>Keep Friend</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.destructive }]}
              onPress={onConfirm}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Remove friend"
            >
              <Text style={[styles.btnText, { color: colors.destructiveForeground }]}>Remove Friend</Text>
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
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
