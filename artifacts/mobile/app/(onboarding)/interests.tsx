/**
 * Onboarding — Interests step
 *
 * Loads active interests from the database and saves the user's selections
 * to user_interests. Falls back to hardcoded categories when Supabase is
 * not configured (development mode).
 *
 * Requirements:
 *   - Require at least 1 interest (recommend 3+)
 *   - Allow deselection
 *   - Skippable (selections can be updated from Profile later)
 *   - Save selection to DB before continuing
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '@/features/auth/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { getAllInterests, setMyInterests } from '@/services/profile/profile.service';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { analytics } from '@/lib/auth/analyticsHooks';
import type { InterestRow } from '@/lib/supabase/database.types';

// ─── Dev fallback interests (used when DB is not configured) ──────────────────

const DEV_INTERESTS: InterestRow[] = [
  'Outdoors & Nature', 'Photography', 'History & Culture', 'Food & Discovery',
  'Running', 'Cycling', 'Mindfulness', 'Art', 'Community', 'Learning',
  'Exploration', 'Social Activities', 'Urban Exploring', 'Hidden Gems', 'Wildlife',
].map((name, i) => ({
  id: `dev-${i}`,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  description: null,
  icon_key: null,
  is_active: true,
  sort_order: i,
  created_at: '',
  updated_at: '',
}));

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingInterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();

  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const topPad = Platform.OS === 'web' ? 48 : insets.top + spacing[4];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  // ── Load interests ────────────────────────────────────────────────────────

  const loadInterests = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!isSupabaseConfigured()) {
        setInterests(DEV_INTERESTS);
      } else {
        const data = await getAllInterests();
        setInterests(data.length > 0 ? data : DEV_INTERESTS);
      }
    } catch {
      setLoadError('Could not load interests. Tap to retry.');
      setInterests(DEV_INTERESTS); // fall back to dev interests
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadInterests(); }, [loadInterests]);

  // ── Toggle interest ───────────────────────────────────────────────────────

  const toggleInterest = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Continue ──────────────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (isSaving) return;

    if (user && isSupabaseConfigured() && selected.size > 0) {
      setIsSaving(true);
      try {
        await setMyInterests(user.id, Array.from(selected));
      } catch (err) {
        if (__DEV__) console.warn('[Interests] Save failed:', err);
        // Non-fatal — user can update later from Profile
      } finally {
        setIsSaving(false);
      }
    }

    analytics.onboardingInterestsCompleted(selected.size);
    router.push('/(onboarding)/location');
  }, [user, selected, isSaving, router]);

  const handleSkip = useCallback(() => {
    analytics.onboardingInterestsCompleted(0);
    router.push('/(onboarding)/location');
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 1 of 3</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>What interests you?</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We'll personalise your quest and hunt recommendations.
            {' '}
            <Text style={{ color: colors.primary }}>Select at least one</Text>
            , or skip for now.
          </Text>
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading interests…
            </Text>
          </View>
        )}

        {/* Error + retry */}
        {loadError && !isLoading && (
          <Pressable onPress={loadInterests} style={[styles.errorWrap, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{loadError}</Text>
          </Pressable>
        )}

        {/* Interest bubbles */}
        {!isLoading && interests.length > 0 && (
          <View style={styles.bubbles}>
            {interests.map((interest) => {
              const isSelected = selected.has(interest.id);
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => toggleInterest(interest.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={interest.name}
                  style={({ pressed }) => [
                    styles.bubble,
                    {
                      backgroundColor: isSelected ? colors.primary + '15' : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.full,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.bubbleText, {
                      color: isSelected ? colors.primary : colors.foreground,
                      fontFamily: isSelected ? fontFamily.semiBold : fontFamily.regular,
                    }]}
                  >
                    {interest.name}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={13} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {selected.size > 0 && (
          <Text style={[styles.selectionCount, { color: colors.mutedForeground }]}>
            {selected.size} selected
            {selected.size < 3 ? ` — we recommend at least 3` : ''}
          </Text>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: bottomPad }]}>
        <Button variant="ghost" size="md" onPress={handleSkip} disabled={isSaving}>
          Skip for now
        </Button>
        <Button
          variant="primary"
          size="lg"
          onPress={handleContinue}
          loading={isSaving}
          disabled={isSaving}
          style={{ flex: 1 }}
        >
          {selected.size > 0 ? `Continue (${selected.size})` : 'Continue'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  header: { gap: spacing[2] },
  step: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  loadingText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  errorWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderWidth: 1 },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
    borderWidth: 1.5,
  },
  bubbleText: { fontSize: fontSize.sm },
  selectionCount: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[5], paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
