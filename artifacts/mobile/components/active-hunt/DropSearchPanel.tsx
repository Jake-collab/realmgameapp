import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { PublicHuntSearchZone } from '@/features/hunts/types/canonicalHunt.types';

export function DropSearchPanel(props: {
  zone: PublicHuntSearchZone;
  onCollect: () => void;
  isCollecting: boolean;
  errorMessage?: string | null;
}) {
  const colors = useColors();
  const collected = props.zone.collectionState === 'COLLECTED';
  return (
    <View style={[styles.card, { backgroundColor: colors.hunt + '10', borderColor: colors.hunt + '35' }]}>
      <View style={styles.heading}>
        <Feather name={collected ? 'check-circle' : 'compass'} size={18} color={colors.hunt} />
        <Text style={[styles.title, { color: colors.foreground }]}>{collected ? 'Drop collected' : 'Search area unlocked'}</Text>
      </View>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>
        {collected
          ? 'This Drop is saved to your Hunt progress.'
          : `Search this approximate ${props.zone.searchRadiusMeters}m area. When you find the Drop, collect it with a fresh location check.`}
      </Text>
      {!collected && (
        <TouchableOpacity
          onPress={props.onCollect}
          disabled={props.isCollecting}
          style={[styles.button, { backgroundColor: colors.hunt, opacity: props.isCollecting ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Collect Hunt Drop"
        >
          {props.isCollecting ? <ActivityIndicator color="#fff" /> : <Feather name="camera" size={16} color="#fff" />}
          <Text style={styles.buttonText}>{props.isCollecting ? 'Verifying location…' : `Collect · ${props.zone.points} Hunt Points`}</Text>
        </TouchableOpacity>
      )}
      {props.errorMessage ? <Text style={styles.error}>{props.errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  copy: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18 },
  button: { marginTop: spacing[1], minHeight: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing[2] },
  buttonText: { color: '#fff', fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  error: { color: '#B91C1C', fontFamily: fontFamily.medium, fontSize: fontSize.xs },
});