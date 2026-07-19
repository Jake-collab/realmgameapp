/**
 * PointTransactionRow — A single quest-related point ledger entry.
 *
 * Shows amount, display label, quest title, and date.
 * Reversals are shown as separate offsetting entries with negative amounts.
 * Never shows raw reason field or ledger IDs.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { QuestPointTransaction } from '@/features/quests/types/questProgress.types';

interface Props {
  transaction: QuestPointTransaction;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PointTransactionRow({ transaction }: Props) {
  const colors = useColors();

  const isPositive = transaction.amount > 0;
  const isReversal = transaction.isReversal;

  const amountColor = isPositive ? colors.success : colors.destructive;
  const amountPrefix = isPositive ? '+' : '';
  const iconName: React.ComponentProps<typeof Feather>['name'] = isReversal
    ? 'minus-circle'
    : isPositive
    ? 'plus-circle'
    : 'minus-circle';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${transaction.displayLabel}: ${amountPrefix}${transaction.amount.toLocaleString()} points on ${formatDate(transaction.createdAt)}${transaction.questTitle ? ` for ${transaction.questTitle}` : ''}`}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: isReversal ? colors.warning + '18' : isPositive ? colors.success + '18' : colors.destructive + '18' },
        ]}
        accessibilityElementsHidden
      >
        <Feather name={iconName} size={18} color={isReversal ? colors.warning : amountColor} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {transaction.displayLabel}
        </Text>
        {transaction.questTitle && (
          <Text style={[styles.questTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {transaction.questTitle}
          </Text>
        )}
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(transaction.createdAt)}
        </Text>
      </View>

      <Text
        style={[styles.amount, { color: amountColor }]}
        accessibilityElementsHidden
      >
        {amountPrefix}{Math.abs(transaction.amount).toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  questTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
});
