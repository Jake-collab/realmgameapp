/**
 * HuntProgressSegmentedControl — 3-tab internal nav for Hunt Progress screen.
 *
 * Tabs: Leaderboards | In Action | Completed
 * Urgency dot on "In Action" when stops need attention.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntProgressSection } from '@/features/hunts/types/huntProgress.types';

const TABS: { key: HuntProgressSection; label: string }[] = [
  { key: 'leaderboards', label: 'Leaderboards' },
  { key: 'in_action',    label: 'In Action' },
  { key: 'completed',    label: 'Completed' },
];

interface Props {
  activeSection: HuntProgressSection;
  onSelect: (section: HuntProgressSection) => void;
  inActionUrgentCount?: number;
}

export default function HuntProgressSegmentedControl({
  activeSection,
  onSelect,
  inActionUrgentCount = 0,
}: Props) {
  const colors = useColors();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.muted, borderRadius: radius.lg }]}
      accessibilityRole="tablist"
    >
      {TABS.map(tab => {
        const isActive = tab.key === activeSection;
        const showDot = tab.key === 'in_action' && inActionUrgentCount > 0;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              isActive && [styles.activeTab, { backgroundColor: colors.card, borderRadius: radius.md }],
            ]}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label}${showDot ? `, ${inActionUrgentCount} item${inActionUrgentCount !== 1 ? 's' : ''} need attention` : ''}`}
          >
            <View style={styles.tabContent}>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.foreground : colors.mutedForeground,
                    fontFamily: isActive ? fontFamily.semiBold : fontFamily.regular,
                  },
                ]}
              >
                {tab.label}
              </Text>
              {showDot && (
                <View
                  style={[styles.urgencyDot, { backgroundColor: colors.destructive }]}
                  accessibilityElementsHidden
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    fontSize: fontSize.sm,
  },
  urgencyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
