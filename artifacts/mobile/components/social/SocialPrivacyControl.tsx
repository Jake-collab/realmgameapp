/**
 * SocialPrivacyControl — a single toggle row or picker row for privacy settings.
 */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface ToggleProps {
  kind: 'toggle';
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

interface PickerProps {
  kind: 'picker';
  label: string;
  description?: string;
  currentLabel: string;
  onPress: () => void;
}

type SocialPrivacyControlProps = ToggleProps | PickerProps;

export function SocialPrivacyControl(props: SocialPrivacyControlProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.foreground }]}>{props.label}</Text>
        {props.description && (
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{props.description}</Text>
        )}
      </View>
      {props.kind === 'toggle' ? (
        <Switch
          value={props.value}
          onValueChange={props.onChange}
          disabled={props.disabled}
          thumbColor="#FFF"
          trackColor={{ false: colors.muted, true: colors.primary }}
          accessibilityLabel={props.label}
          accessibilityRole="switch"
          accessibilityState={{ checked: props.value }}
        />
      ) : (
        <Pressable style={styles.pickerRight} onPress={props.onPress} accessibilityRole="button">
          <Text style={[styles.pickerValue, { color: colors.mutedForeground }]}>{props.currentLabel}</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
  textBlock: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  desc: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  pickerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  pickerValue: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});
