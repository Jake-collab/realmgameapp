import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useRevenueSummary } from '../hooks/useRevenueSummary';

export function RevenueAllowanceCard({ onMembershipPress }: { onMembershipPress: () => void }) {
  const colors = useColors();
  const summary = useRevenueSummary();
  const dropAllowance = summary.data?.allowances.find((item) => item.kind === 'hunt_drop_creation_weekly');
  if (summary.isLoading || !summary.data || !dropAllowance) return null;
  const member = summary.data.planCode !== 'free';
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, padding: spacing[4], gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <View style={{ width: 34, height: 34, borderRadius: radius.lg, backgroundColor: colors.hunt + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="zap" size={17} color={colors.hunt} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>Drop creation balance</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 2 }}>
            {member ? 'Worlds Membership' : 'Free plan'} · server-reset weekly
          </Text>
        </View>
        <TouchableOpacity onPress={onMembershipPress} accessibilityRole="button" accessibilityLabel="View Membership">
          <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Balance label="Included this week" value={`${dropAllowance.remaining}/${dropAllowance.limit}`} colors={colors} />
        <Balance label="Extra Drop Credits" value={String(summary.data.extraDropCredits)} colors={colors} />
      </View>
      {!member && (
        <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 }}>
          Membership includes 5 weekly Drop creations and expanded Quest allowances. Your included Drops are always used before credits.
        </Text>
      )}
    </View>
  );
}

function Balance({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flex: 1, padding: spacing[3], borderRadius: radius.lg, backgroundColor: colors.muted }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.lg, marginTop: 3 }}>{value}</Text>
    </View>
  );
}