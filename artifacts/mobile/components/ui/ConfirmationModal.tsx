/**
 * ConfirmationModal
 *
 * A modal dialog requiring explicit user confirmation before a
 * significant or destructive action. Always presents two options:
 * confirm and cancel.
 *
 * Used for: Start Quest, Leave Hunt, Delete Custom Game, etc.
 * Never use this as a substitute for a bottom sheet with rich content.
 *
 * Usage:
 *   <ConfirmationModal
 *     visible={showModal}
 *     title="Start Quest"
 *     description="Once you start, your timer begins. Are you ready?"
 *     confirmLabel="Start Quest"
 *     onConfirm={handleStart}
 *     onCancel={() => setShowModal(false)}
 *   />
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import Button from './Button';

interface Props {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses the destructive style. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional Feather icon shown above the title */
  icon?: React.ComponentProps<typeof Feather>['name'];
  iconColor?: string;
}

export default function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  icon,
  iconColor,
}: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.xl,
            },
          ]}
          // Prevent backdrop tap from propagating
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          {icon && (
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: (iconColor ?? colors.primary) + '15',
                  borderRadius: radius.lg,
                },
              ]}
            >
              <Feather
                name={icon}
                size={28}
                color={iconColor ?? colors.primary}
              />
            </View>
          )}

          {/* Text */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {description}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              size="lg"
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
            <Button variant="ghost" size="lg" onPress={onCancel}>
              {cancelLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    padding: spacing[6],
    gap: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  actions: {
    width: '100%',
    gap: spacing[2],
    marginTop: spacing[2],
  },
});
