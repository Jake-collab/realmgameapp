# Social Architecture — Worlds (Prompt 16)

## Overview

Prompt 16 implements the foundational social layer for Worlds. It provides safe public profiles, user discovery, friend requests, friendship management, blocking, reporting entry points, and social privacy controls — without a public activity feed, direct messaging, or follower relationships.

## Module Structure

```
features/social/
  types/social.types.ts          ← All domain types; PublicIdentity, PublicProfile,
                                    SocialRelationshipState, SocialPrivacySettings, etc.
  queries/socialKeys.ts          ← React Query key factory (namespace: 'social')
  constants/social.constants.ts  ← Rate limits, timeouts, privacy defaults
  repositories/social.repository.ts ← RPC wrappers; snake_case → camelCase mapping
  hooks/                         ← 19 React Query hooks
    usePublicProfile.ts
    useSocialRelationship.ts
    useFriends.ts
    useReceivedFriendRequests.ts
    useSentFriendRequests.ts
    useSearchPeople.ts
    useSendFriendRequest.ts
    useAcceptFriendRequest.ts
    useDeclineFriendRequest.ts
    useCancelFriendRequest.ts
    useRemoveFriend.ts
    useBlockUser.ts
    useUnblockUser.ts
    useBlockedUsers.ts
    useSocialPrivacySettings.ts
    useUpdateSocialPrivacySettings.ts
    useMutualFriendCount.ts
    useHuntInvitationEligibility.ts
    useSubmitUserReport.ts

components/social/               ← 16 reusable UI components
  PublicProfileHeader.tsx
  PublicProgressionPreview.tsx
  PublicStatisticsSummary.tsx
  RelationshipStatusBadge.tsx
  MutualFriendSummary.tsx
  FriendCard.tsx
  FriendRequestCard.tsx
  UserSearchInput.tsx
  UserSearchResult.tsx
  BlockUserConfirmation.tsx
  RemoveFriendConfirmation.tsx
  ReportUserEntry.tsx
  BlockedUserRow.tsx
  SocialEmptyState.tsx
  SocialSkeleton.tsx
  SocialPrivacyControl.tsx

app/(main)/
  public-profile/[userRef].tsx   ← Public Profile screen (userRef = username)
  friends.tsx                    ← Friends list
  friend-requests.tsx            ← Received + Sent requests (segmented)
  find-people.tsx                ← Username search
  social-privacy.tsx             ← Privacy settings
  blocked-users.tsx              ← Blocked users list
```

## Key Design Decisions

### Public User Reference
The opaque public identifier is the **username** (already unique, lowercase, URL-safe). Internal UUIDs never appear in deep-link URLs or client-visible keys.

### Canonical Pair Ordering
Friendships use `user_id_a < user_id_b` (UUID lexicographic) to prevent duplicates without a query for direction. A partial unique index enforces one active friendship per pair.

### Reverse Friend Request Policy (Build 1)
When A sends a request to B while B already has a valid pending request to A, the server auto-accepts the reverse request atomically. This creates a friendship without requiring explicit acceptance of both sides. Documented in `FRIEND_REQUESTS.md`.

### Blocked-by-Other Privacy
When the current user has been blocked by a target, `get_public_profile` returns `{unavailable: true, reason: 'unavailable'}` — identical to a not-found profile. The client cannot distinguish "they blocked me" from "profile not found". This prevents block enumeration.

### Statistics Visibility Default
Statistics (quest counts, points) default to `show_statistics = FALSE` (friends-only). Users must explicitly enable public statistics.

### No Activity Feed
Social features intentionally exclude a public activity feed, online status, last-seen, or real-time presence. These are out of scope for Build 1 and by design.

## Navigation
Social features are nested under Profile — no new bottom tab was added.

Profile tab additions (Prompt 16):
- Friends
- Friend Requests (with pending badge count)
- Find People
- Privacy → Social Privacy Settings → Blocked Users
