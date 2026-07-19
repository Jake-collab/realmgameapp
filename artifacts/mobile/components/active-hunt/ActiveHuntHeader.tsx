/**
 * ActiveHuntHeader — Worlds (Prompt 13)
 *
 * Compact header for the Active Hunt screen.
 * Contains: back button, hunt title, status dot, "..." menu.
 *
 * The "..." menu hosts secondary actions (withdraw, safety info, etc.)
 * Withdrawal is NEVER a prominent primary button.
 */

import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface ActiveHuntHeaderProps {
  huntTitle: string;
  participationStatus: string;
  onWithdraw: () => void;
  onViewDetails: () => void;
  onSafetyInfo: () => void;
}

export function ActiveHuntHeader({
  huntTitle,
  participationStatus,
  onWithdraw,
  onViewDetails,
  onSafetyInfo,
}: ActiveHuntHeaderProps) {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = useState(false);

  const statusColor = participationStatus === 'active'  ? colors.hunt :
                      participationStatus === 'paused'  ? '#F59E0B' :
                      colors.mutedForeground;

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {/* Back */}
      <TouchableOpacity
        onPress={() => router.push('/(main)/hunt/my-hunts')}
        style={[styles.iconBtn, { backgroundColor: colors.card }]}
        accessibilityLabel="Return to My Hunts"
        accessibilityRole="button"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>

      {/* Title + status */}
      <View style={styles.titleRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {huntTitle || 'Active Hunt'}
        </Text>
      </View>

      {/* Menu */}
      <TouchableOpacity
        onPress={() => setMenuOpen(true)}
        style={[styles.iconBtn, { backgroundColor: colors.card }]}
        accessibilityLabel="More options"
        accessibilityRole="button"
      >
        <Feather name="more-horizontal" size={20} color={colors.foreground} />
      </TouchableOpacity>

      {/* Dropdown menu modal */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuCard, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            top: Platform.OS === 'ios' ? 100 : 72,
          }]}>
            <MenuItem
              icon="map"
              label="View Hunt Details"
              onPress={() => { setMenuOpen(false); onViewDetails(); }}
              colors={colors}
            />
            <MenuItem
              icon="shield"
              label="Safety Information"
              onPress={() => { setMenuOpen(false); onSafetyInfo(); }}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="log-out"
              label="Withdraw from Hunt"
              onPress={() => { setMenuOpen(false); onWithdraw(); }}
              colors={colors}
              danger
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon, label, onPress, colors, danger = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  danger?: boolean;
}) {
  const textColor = danger ? '#EF4444' : colors.foreground;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.menuItem}
      accessibilityRole="button"
    >
      <Feather name={icon as any} size={16} color={textColor} />
      <Text style={[styles.menuLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing[4],
    paddingTop:       Platform.OS === 'ios' ? 52 : 16,
    paddingBottom:    spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:              spacing[3],
    zIndex:           10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.base,
    flex:       1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuCard: {
    position:    'absolute',
    right:       spacing[4],
    borderWidth: 1,
    borderRadius: radius.lg,
    minWidth:    220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:   6,
    overflow:    'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
  },
  menuLabel: {
    fontFamily: fontFamily.medium,
    fontSize:   fontSize.sm,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[1],
  },
});
