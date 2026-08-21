/**
 * Find People Screen — Worlds (Prompt 16)
 *
 * Username-based search with debouncing, minimum length enforcement,
 * and relationship-state-aware results.
 *
 * Security:
 * - Minimum 2 characters before any RPC fires.
 * - Debounced input — no search on every keystroke.
 * - Search results exclude blocked, hidden, suspended, deactivated users (server-side).
 * - No email, phone, exact location, or contact-book features.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useSearchPeople } from '@/features/social/hooks/useSearchPeople';
import { UserSearchInput } from '@/components/social/UserSearchInput';
import { UserSearchResult } from '@/components/social/UserSearchResult';
import { SocialEmptyState } from '@/components/social/SocialEmptyState';

export default function FindPeopleScreen() {
  const colors = useColors();
  const [query, setQuery] = useState('');

  const { data: results, isLoading, isFetching } = useSearchPeople(query);
  const hasResults = results && results.length > 0;
  const noResults  = query.trim().length >= 2 && !isLoading && !isFetching && results?.length === 0;
  const isIdle     = query.trim().length < 2;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Find People</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search input */}
      <View style={styles.searchRow}>
        <UserSearchInput onQueryChange={setQuery} placeholder="Search by username…" />
      </View>

      {/* Live region for screen readers */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          isLoading ? 'Searching…' :
          noResults ? 'No matching profiles were found.' :
          hasResults ? `${results.length} result${results.length !== 1 ? 's' : ''} found` : ''
        }
        style={{ height: 0 }}
      />

      {/* Results */}
      {isIdle ? (
        <SocialEmptyState variant="search_before" />
      ) : isLoading || isFetching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : noResults ? (
        <SocialEmptyState variant="search_no_results" />
      ) : hasResults ? (
        <FlatList
          data={results}
          keyExtractor={r => r.username}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <UserSearchResult
              result={item}
              onPress={() => router.push(`/public-profile/${item.username}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[5], paddingTop: spacing[12], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  searchRow: { padding: spacing[5], paddingBottom: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing[5], paddingTop: spacing[2] },
});
