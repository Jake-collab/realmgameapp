/**
 * Friends Screen — Worlds (Prompt 16)
 *
 * Accessible from Profile → Friends.
 * Shows the current user's accepted friends list.
 * Does NOT show: online status, last active, current location, active Hunt/Quest.
 */

import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useFriends } from '@/features/social/hooks/useFriends';
import type { FriendEntry } from '@/features/social/types/social.types';
import { FriendCard } from '@/components/social/FriendCard';
import { UserSearchInput } from '@/components/social/UserSearchInput';
import { SocialEmptyState } from '@/components/social/SocialEmptyState';
import { SocialSkeleton } from '@/components/social/SocialSkeleton';

export default function FriendsScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const { data: friends, isLoading, error, refetch } = useFriends(search.trim() || undefined);

  function handleViewProfile(friend: FriendEntry) {
    router.push(`/public-profile/${friend.username}`);
  }

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
        <Text style={[styles.title, { color: colors.foreground }]}>
          Friends{friends ? ` (${friends.length})` : ''}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <UserSearchInput onQueryChange={setSearch} placeholder="Search friends…" />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.listContent}>
          <SocialSkeleton count={5} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Could not load friends.
          </Text>
          <Pressable onPress={() => refetch()} accessibilityRole="button">
            <Text style={[styles.retry, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : !friends || friends.length === 0 ? (
        <SocialEmptyState
          variant="friends"
          onAction={() => router.push('/find-people')}
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={f => f.username}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FriendCard friend={item} onPress={() => handleViewProfile(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  searchBar: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  listContent: { padding: spacing[5], paddingTop: spacing[2], gap: spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  retry: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
});
