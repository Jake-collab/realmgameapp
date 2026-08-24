import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useHuntInvitationEligibility } from '@/features/social/hooks/useHuntInvitationEligibility';
import { useHuntCreatorFriendInvite } from '@/features/hunts/hooks/useHuntCreator';

interface HuntFriendSelectorProps {
  huntId: string;
  occurrenceId: string | null;
  onDone?: () => void;
}

export function HuntFriendSelector({ huntId, occurrenceId, onDone }: HuntFriendSelectorProps) {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [selectedUsername, setSelectedUsername] = useState<string>();
  const friendsQuery = useFriends(search);
  const eligibility = useHuntInvitationEligibility(selectedUsername, huntId, occurrenceId ?? undefined);
  const invite = useHuntCreatorFriendInvite();
  const friends = friendsQuery.data ?? [];
  const selected = friends.find(friend => friend.username === selectedUsername);

  const sendInvite = () => {
    if (!selectedUsername || !occurrenceId) return;
    invite.mutate({ huntId, occurrenceId, username: selectedUsername }, { onSuccess: () => {
      setSelectedUsername(undefined);
      onDone?.();
    }});
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}><Feather name="user-plus" size={18} color={colors.hunt} /><Text style={[styles.title, { color: colors.foreground }]}>Invite friends</Text></View>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>Only friends who can join this Hunt are available to invite.</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search friends"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.inputBorder }]}
      />
      {friendsQuery.isLoading ? <ActivityIndicator color={colors.hunt} /> : (
        <View style={styles.friendList}>
          {friends.slice(0, 8).map(friend => <Pressable key={friend.username} onPress={() => setSelectedUsername(friend.username)} style={[styles.friend, { borderColor: selectedUsername === friend.username ? colors.hunt : colors.border, backgroundColor: selectedUsername === friend.username ? colors.hunt + '12' : 'transparent' }]}>
            <View style={[styles.avatar, { backgroundColor: colors.hunt + '18' }]}><Text style={[styles.avatarText, { color: colors.hunt }]}>{friend.displayName.charAt(0).toUpperCase()}</Text></View>
            <View style={styles.friendCopy}><Text style={[styles.friendName, { color: colors.foreground }]}>{friend.displayName}</Text><Text style={[styles.username, { color: colors.mutedForeground }]}>@{friend.username}</Text></View>
            {selectedUsername === friend.username && <Feather name="check-circle" size={18} color={colors.hunt} />}
          </Pressable>)}
          {!friends.length && <Text style={[styles.description, { color: colors.mutedForeground }]}>No matching friends yet.</Text>}
        </View>
      )}
      {selected && <View style={[styles.selection, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.selectionText, { color: colors.secondaryForeground }]}>
          {eligibility.isLoading ? 'Checking eligibility…' : eligibility.data?.eligible ? `${selected.displayName} can join.` : 'This friend cannot be invited to this Hunt.'}
        </Text>
        <Button onPress={sendInvite} disabled={!eligibility.data?.eligible || invite.isPending} loading={invite.isPending} size="sm">Send invite</Button>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing[4], marginTop: spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md },
  description: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing[2] },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], fontFamily: fontFamily.regular, fontSize: fontSize.base, marginVertical: spacing[3] },
  friendList: { gap: spacing[2] },
  friend: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm },
  friendCopy: { flex: 1 },
  friendName: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 1 },
  selection: { padding: spacing[3], borderRadius: radius.md, marginTop: spacing[3], gap: spacing[2] },
  selectionText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});