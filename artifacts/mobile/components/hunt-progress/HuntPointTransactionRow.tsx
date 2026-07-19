/**
 * HuntPointTransactionRow — A single Hunt-related point ledger entry.
 *
 * Shows amount, display label, hunt title, and date.
 * Reversals shown as separate offsetting entries.
 * Never shows raw reason field or ledger IDs.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntPointTransaction } from '@/features/hunts/types/huntProgress.types';

interface Props {
  transaction: HuntPointTransaction;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HuntPointTransactionRow({ transaction }: Props) {
  const colors   = useColors();
  const isPos    = transaction.amount > 0;
  const isRev    = transaction.isReversal;
  const amtColor = isPos ? colors.success : colors.destructive;
  const prefix   = isPos ? '+' : '';

  const iconName: React.ComponentProps<typeof Feather>['name'] = isRev
    ? 'minus-circle'
    : isPos
    ? 'plus-circle'
    : 'minus-circle';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${transaction.displayLabel}: ${prefix}${transaction.amount.toLocaleString()} points on ${formatDate(transaction.createdAt)}${transaction.huntTitle ? ` for ${transaction.huntTitle}` : ''}`}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isRev
              ? colors.warning + '18'
              : isPos
              ? colors.success + '18'
              : colors.destructive + '18',
          },
        ]}
        accessibilityElementsHidden
      >
        <Feather name={iconName} size={18} color={isRev ? colors.warning : amtColor} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {transaction.displayLabel}
        </Text>
        {transaction.huntTitle && (
          <Text style={[styles.huntTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {transaction.huntTitle}
          </Text>
        )}
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(transaction.createdAt)}
        </Text>
      </View>

      <Text style={[styles.amount, { color: amtColor }]} accessibilityElementsHidden>
        {prefix}{Math.abs(transaction.amount).toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  iconBox: {
    width: 38, height: 38, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  huntTitle: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  amount: { fontFamily: fontFamily.bold, fontSize: fontSize.base },
});
