/**
 * Quest — Map Tab
 *
 * Polished placeholder until Prompts 9–10 implement Mapbox Geo-Quest mapping.
 * Explains the upcoming feature clearly without showing a fake interactive map.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

export default function QuestMapScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Map preview placeholder */}
      <View
        style={[
          styles.mapPlaceholder,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        {/* Grid lines suggest a map */}
        <View style={[styles.gridH, { backgroundColor: colors.border }]} />
        <View style={[styles.gridH, { backgroundColor: colors.border, top: '33%' }]} />
        <View style={[styles.gridH, { backgroundColor: colors.border, top: '66%' }]} />
        <View style={[styles.gridV, { backgroundColor: colors.border }]} />
        <View style={[styles.gridV, { backgroundColor: colors.border, left: '66%' }]} />

        {/* Centered icon */}
        <View style={[styles.mapCenter, { backgroundColor: colors.accent + '18', borderRadius: radius.xl }]}>
          <Feather name="map" size={40} color={colors.accent} />
        </View>
      </View>

      {/* Info card */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: colors.accent + '18' }]}>
          <Feather name="map-pin" size={24} color={colors.accent} />
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Geo-Quest Map Coming Soon
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          The Geo-Quest map will show quest waypoints, locations, and availability zones near you.
          It uses a privacy-preserving location system that never stores your precise coordinates.
        </Text>

        {/* Features preview */}
        <View style={[styles.featureList, { borderTopColor: colors.border }]}>
          {[
            { icon: 'map-pin' as const, text: 'Nearby quest locations' },
            { icon: 'eye-off'  as const, text: 'Privacy-safe — no continuous tracking' },
            { icon: 'layers'   as const, text: 'Availability zones overlaid on map' },
            { icon: 'compass'  as const, text: 'Distance to each quest shown' },
          ].map(f => (
            <View key={f.text} style={styles.featureRow}>
              <Feather name={f.icon} size={15} color={colors.accent} />
              <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Browse geo quests as list instead */}
      <TouchableOpacity
        onPress={() => router.push('/quest/quests')}
        style={[
          styles.fallbackButton,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name="list" size={18} color={colors.primary} />
        <Text style={[styles.fallbackText, { color: colors.primary }]}>
          Browse Geo-Quests as a list
        </Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[5],
    gap: spacing[4],
  },
  mapPlaceholder: {
    height: 220,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    top: '50%',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    left: '33%',
  },
  mapCenter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    padding: spacing[5],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[4],
    gap: spacing[3],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    flex: 1,
  },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
});
