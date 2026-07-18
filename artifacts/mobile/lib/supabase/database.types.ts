/**
 * Generated database types — Worlds
 *
 * This file represents the authoritative TypeScript shape of the Supabase
 * database schema (Build 1, Prompt 3). It is hand-authored to match the
 * migration files exactly. Regenerate from the CLI after applying migrations:
 *
 *   npx supabase gen types typescript --project-id <your-project-id> \
 *     --schema public > lib/supabase/database.types.ts
 *
 * Until a live Supabase project is connected, this file serves as the
 * type contract. Do NOT hand-write service code that contradicts these types.
 */

// ─── Enum types ───────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'creator' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'deactivated';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';
export type GameMode = 'quest' | 'hunt';
export type MediaType = 'image' | 'video' | 'document' | 'audio';
export type MediaVisibility = 'private' | 'restricted' | 'public';
export type ModerationStatus = 'pending' | 'scanning' | 'approved' | 'rejected' | 'manual_review';
export type QuestType = 'daily' | 'monthly' | 'geo';
export type QuestStatus =
  | 'draft' | 'pending_review' | 'approved' | 'scheduled'
  | 'published' | 'paused' | 'expired' | 'archived' | 'rejected';
export type QuestSourceType = 'admin' | 'ai' | 'system';
export type Difficulty = 'very_easy' | 'easy' | 'medium' | 'hard' | 'epic';
export type ProofType = 'photo' | 'video' | 'text' | 'location' | 'qr_code' | 'none';
export type LocationRequirementType = 'none' | 'approximate' | 'precise';
export type IndoorOutdoor = 'indoor' | 'outdoor' | 'both';
export type ParticipationStatus =
  | 'started' | 'in_progress' | 'awaiting_proof' | 'under_review'
  | 'needs_resubmission' | 'completed' | 'rejected' | 'abandoned' | 'expired';
export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type ProofSubmissionStatus =
  | 'draft' | 'uploading' | 'submitted' | 'under_review'
  | 'approved' | 'rejected' | 'needs_resubmission';
export type HuntType = 'official' | 'custom' | 'community';
export type HuntStatus =
  | 'draft' | 'pending_review' | 'ready' | 'scheduled' | 'active'
  | 'paused' | 'completed' | 'cancelled' | 'expired' | 'archived' | 'rejected';
export type HuntPrivacy = 'public' | 'unlisted' | 'invite_only' | 'private';
export type HuntJoinPolicy = 'open' | 'approval_required' | 'invite_only';
export type ParticipantRole = 'creator' | 'player' | 'co_host';
export type ParticipantStatus =
  | 'invited' | 'accepted' | 'ready' | 'active' | 'paused'
  | 'completed' | 'declined' | 'removed' | 'left' | 'expired';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
export type PointTransactionType =
  | 'quest_reward' | 'hunt_reward' | 'achievement_reward' | 'admin_adjustment' | 'reversal';
export type AchievementCategory = 'quest' | 'hunt' | 'exploration' | 'milestone' | 'community' | 'event';
export type NotificationType =
  | 'quest_available' | 'monthly_drop' | 'hunt_invitation' | 'hunt_accepted'
  | 'hunt_starting' | 'proof_approved' | 'proof_rejected' | 'needs_resubmission'
  | 'achievement_earned' | 'admin_message' | 'safety_action';
export type ReportStatus =
  | 'submitted' | 'triaged' | 'under_review' | 'action_taken'
  | 'dismissed' | 'appealed' | 'closed';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportableEntity =
  | 'user_profile' | 'quest' | 'hunt' | 'hunt_stop' | 'custom_game'
  | 'media_asset' | 'proof_submission' | 'other';
export type ModerationCaseStatus =
  | 'open' | 'under_review' | 'action_taken' | 'dismissed' | 'appealed' | 'closed';
export type AiGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AiApprovalStatus = 'pending_review' | 'approved' | 'rejected' | 'needs_revision';

// ─── Row types ────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  role: UserRole;
  account_status: AccountStatus;
  onboarding_status: OnboardingStatus;
  onboarding_completed_at: string | null;
  preferred_game_mode: GameMode;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRow {
  id: string;
  user_id: string;
  notify_quest_available: boolean;
  notify_monthly_drop: boolean;
  notify_hunt_invitation: boolean;
  notify_hunt_updates: boolean;
  notify_proof_decisions: boolean;
  notify_achievements: boolean;
  notify_admin_messages: boolean;
  notify_marketing: boolean;
  profile_visibility: 'public' | 'friends' | 'private';
  leaderboard_visibility: boolean;
  allow_hunt_invitations: boolean;
  location_sharing_enabled: boolean;
  location_precision: 'approximate' | 'precise';
  preferred_units: 'metric' | 'imperial';
  theme_preference: 'light' | 'dark' | 'system';
  reduce_motion: boolean;
  last_game_mode: GameMode;
  last_quest_tab: string;
  last_hunt_tab: string;
  onboarding_progress: OnboardingProgress;
  created_at: string;
  updated_at: string;
}

export interface OnboardingProgress {
  step: 'not_started' | 'interests' | 'location' | 'starting_mode' | 'complete';
  interests_saved: boolean;
  location_explanation_shown: boolean;
  location_permission_granted: boolean;
  starting_mode_selected: boolean;
}

export interface InterestRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_key: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserInterestRow {
  user_id: string;
  interest_id: string;
  created_at: string;
}

export interface MediaAssetRow {
  id: string;
  owner_user_id: string;
  bucket: string;
  storage_path: string;
  media_type: MediaType;
  mime_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  purpose: string;
  visibility: MediaVisibility;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QuestRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  quest_type: QuestType;
  status: QuestStatus;
  difficulty: Difficulty;
  estimated_duration_minutes: number | null;
  points_reward: number;
  indoor_outdoor: IndoorOutdoor;
  accessibility_notes: string | null;
  safety_notes: string | null;
  proof_type: ProofType;
  location_requirement_type: LocationRequirementType;
  available_from: string | null;
  available_until: string | null;
  published_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  source_type: QuestSourceType;
  ai_generation_id: string | null;
  is_repeatable: boolean;
  repeat_cooldown_hours: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface QuestObjectiveRow {
  id: string;
  quest_id: string;
  sort_order: number;
  title: string;
  instructions: string;
  is_required: boolean;
  is_optional: boolean;
  proof_type: ProofType;
  location_requirement_type: LocationRequirementType;
  completion_rule: string;
  created_at: string;
  updated_at: string;
}

export interface QuestCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_key: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuestLocationRow {
  id: string;
  quest_id: string;
  display_name: string;
  public_lat: number | null;
  public_lng: number | null;
  public_radius_meters: number | null;
  address_hint: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestParticipationRow {
  id: string;
  quest_id: string;
  user_id: string;
  status: ParticipationStatus;
  started_at: string;
  last_progress_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  expires_at: string | null;
  awarded_points: number | null;
  completion_version: number;
  created_at: string;
  updated_at: string;
}

export interface QuestStepProgressRow {
  id: string;
  participation_id: string;
  quest_step_id: string;
  status: StepStatus;
  completed_at: string | null;
  progress_value: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofSubmissionRow {
  id: string;
  user_id: string;
  quest_participation_id: string | null;
  hunt_stop_progress_id: string | null;
  submission_type: ProofType;
  text_response: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_meters: number | null;
  status: ProofSubmissionStatus;
  moderation_status: ModerationStatus;
  review_notes: string | null;
  reviewer_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  previous_submission_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HuntRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  hunt_type: HuntType;
  status: HuntStatus;
  creator_user_id: string | null;
  created_by_admin_id: string | null;
  privacy: HuntPrivacy;
  join_policy: HuntJoinPolicy;
  points_reward: number;
  estimated_duration_minutes: number | null;
  difficulty: Difficulty;
  max_participants: number | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_deadline: string | null;
  published_at: string | null;
  cover_media_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface HuntStopRow {
  id: string;
  hunt_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  is_ordered: boolean;
  is_required: boolean;
  is_hidden: boolean;
  stop_role: 'start' | 'waypoint' | 'final';
  estimated_radius_meters: number | null;
  completion_method: string;
  proof_required: boolean;
  server_reveal_state: 'hidden' | 'revealed_to_participant' | 'public';
  created_at: string;
  updated_at: string;
}

export interface HuntClueRow {
  id: string;
  hunt_stop_id: string;
  sort_order: number;
  clue_text: string | null;
  image_media_id: string | null;
  hint_text: string | null;
  reveal_rule: 'on_stop_reveal' | 'on_request' | 'timed';
  reveal_after_seconds: number | null;
  penalty_points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HuntParticipantRow {
  id: string;
  hunt_id: string;
  user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: string | null;
  ready_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  left_at: string | null;
  awarded_points: number | null;
  created_at: string;
  updated_at: string;
}

export interface HuntInvitationRow {
  id: string;
  hunt_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: InvitationStatus;
  message: string | null;
  expires_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface HuntStopProgressRow {
  id: string;
  hunt_participant_id: string;
  hunt_stop_id: string;
  status: StepStatus;
  revealed_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  validation_method: string | null;
  proof_submission_id: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface PointsLedgerRow {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: PointTransactionType;
  source_type: string;
  source_id: string | null;
  quest_participation_id: string | null;
  hunt_participant_id: string | null;
  achievement_id: string | null;
  reason: string | null;
  idempotency_key: string;
  created_by: string | null;
  created_at: string;
  reversed_transaction_id: string | null;
}

export interface AchievementRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon_key: string | null;
  point_reward: number;
  criteria: Record<string, unknown>;
  is_active: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAchievementRow {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  source_type: string | null;
  source_id: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ReportRow {
  id: string;
  reporter_user_id: string;
  entity_type: ReportableEntity;
  entity_id: string;
  reason: string;
  description: string | null;
  evidence_media_id: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  assigned_moderator_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBlockRow {
  blocker_user_id: string;
  blocked_user_id: string;
  created_at: string;
}

// ─── View types ───────────────────────────────────────────────────────────────

export interface PublicProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  role: UserRole;
  preferred_game_mode: GameMode;
  created_at: string;
}

export interface UserPointTotalRow {
  user_id: string;
  total_points: number;
  transaction_count: number;
  last_transaction_at: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  total_points: number;
  rank: number;
}

// ─── Insert types (omit server-generated fields) ───────────────────────────────

export type ProfileInsert = Pick<ProfileRow,
  'id' | 'username' | 'display_name'
> & Partial<Pick<ProfileRow,
  'bio' | 'avatar_path' | 'preferred_game_mode'
>>;

export type QuestParticipationInsert = Pick<QuestParticipationRow,
  'quest_id' | 'user_id'
> & Partial<Pick<QuestParticipationRow, 'expires_at'>>;

export type ProofSubmissionInsert = Pick<ProofSubmissionRow,
  'user_id' | 'submission_type'
> & Partial<Pick<ProofSubmissionRow,
  'quest_participation_id' | 'hunt_stop_progress_id' | 'text_response' |
  'location_lat' | 'location_lng' | 'location_accuracy_meters' | 'previous_submission_id'
>>;

export type NotificationInsert = Pick<NotificationRow,
  'user_id' | 'type' | 'title' | 'body'
> & Partial<Pick<NotificationRow, 'data' | 'deep_link' | 'expires_at'>>;

export type ReportInsert = Pick<ReportRow,
  'reporter_user_id' | 'entity_type' | 'entity_id' | 'reason'
> & Partial<Pick<ReportRow, 'description' | 'evidence_media_id' | 'priority'>>;

export type HuntInsert = Pick<HuntRow,
  'slug' | 'title' | 'summary' | 'description' | 'hunt_type' | 'points_reward'
> & Partial<Pick<HuntRow,
  'creator_user_id' | 'privacy' | 'join_policy' | 'difficulty' |
  'estimated_duration_minutes' | 'max_participants' | 'starts_at' | 'ends_at'
>>;

// ─── The Database interface (for createClient<Database>) ──────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'role' | 'account_status'>>;
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: Pick<UserSettingsRow, 'user_id'>;
        Update: Partial<Omit<UserSettingsRow, 'id' | 'user_id' | 'created_at'>>;
      };
      interests: {
        Row: InterestRow;
        Insert: never;  // admin-only via service_role
        Update: never;
      };
      user_interests: {
        Row: UserInterestRow;
        Insert: Pick<UserInterestRow, 'user_id' | 'interest_id'>;
        Update: never;
      };
      media_assets: {
        Row: MediaAssetRow;
        Insert: Omit<MediaAssetRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
        Update: Partial<Pick<MediaAssetRow, 'alt_text' | 'visibility' | 'deleted_at'>>;
      };
      quests: {
        Row: QuestRow;
        Insert: never;  // admin-only via service_role
        Update: never;
      };
      quest_objectives: {
        Row: QuestObjectiveRow;
        Insert: never;
        Update: never;
      };
      quest_categories: {
        Row: QuestCategoryRow;
        Insert: never;
        Update: never;
      };
      quest_locations: {
        Row: QuestLocationRow;
        Insert: never;
        Update: never;
      };
      quest_participations: {
        Row: QuestParticipationRow;
        Insert: QuestParticipationInsert;
        Update: Partial<Pick<QuestParticipationRow,
          'status' | 'last_progress_at' | 'submitted_at' | 'abandoned_at'
        >>;
      };
      quest_step_progress: {
        Row: QuestStepProgressRow;
        Insert: Pick<QuestStepProgressRow, 'participation_id' | 'quest_step_id'>;
        Update: Partial<Pick<QuestStepProgressRow, 'status' | 'completed_at' | 'progress_value' | 'notes'>>;
      };
      proof_submissions: {
        Row: ProofSubmissionRow;
        Insert: ProofSubmissionInsert;
        Update: Partial<Pick<ProofSubmissionRow,
          'text_response' | 'location_lat' | 'location_lng' | 'location_accuracy_meters' | 'status'
        >>;
      };
      hunts: {
        Row: HuntRow;
        Insert: HuntInsert;
        Update: Partial<Omit<HuntRow, 'id' | 'created_at' | 'hunt_type'>>;
      };
      hunt_stops: {
        Row: HuntStopRow;
        Insert: never;
        Update: never;
      };
      hunt_clues: {
        Row: HuntClueRow;
        Insert: never;
        Update: never;
      };
      hunt_participants: {
        Row: HuntParticipantRow;
        Insert: Pick<HuntParticipantRow, 'hunt_id' | 'user_id'>;
        Update: Partial<Pick<HuntParticipantRow, 'status' | 'joined_at' | 'ready_at' | 'left_at'>>;
      };
      hunt_invitations: {
        Row: HuntInvitationRow;
        Insert: Pick<HuntInvitationRow,
          'hunt_id' | 'inviter_user_id' | 'invitee_user_id'
        > & Partial<Pick<HuntInvitationRow, 'message' | 'expires_at'>>;
        Update: Partial<Pick<HuntInvitationRow, 'status' | 'responded_at'>>;
      };
      hunt_stop_progress: {
        Row: HuntStopProgressRow;
        Insert: Pick<HuntStopProgressRow, 'hunt_participant_id' | 'hunt_stop_id'>;
        Update: Partial<Pick<HuntStopProgressRow, 'arrived_at' | 'attempt_count'>>;
      };
      points_ledger: {
        Row: PointsLedgerRow;
        Insert: never;  // server-only via service_role
        Update: never;  // immutable
      };
      achievements: {
        Row: AchievementRow;
        Insert: never;
        Update: never;
      };
      user_achievements: {
        Row: UserAchievementRow;
        Insert: never;  // server-only
        Update: never;
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;  // server-only
        Update: Partial<Pick<NotificationRow, 'read_at'>>;
      };
      reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: never;
      };
      user_blocks: {
        Row: UserBlockRow;
        Insert: Pick<UserBlockRow, 'blocker_user_id' | 'blocked_user_id'>;
        Update: never;
      };
    };
    Views: {
      public_profiles: {
        Row: PublicProfileRow;
      };
      user_point_totals: {
        Row: UserPointTotalRow;
      };
      leaderboard_global: {
        Row: LeaderboardRow;
      };
      leaderboard_quest: {
        Row: LeaderboardRow & { quest_points: number };
      };
      leaderboard_hunt: {
        Row: LeaderboardRow & { hunt_points: number };
      };
      leaderboard_monthly: {
        Row: LeaderboardRow & { period_points: number };
      };
    };
    Functions: {
      get_unread_notification_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_user_rank: {
        Args: { p_user_id: string };
        Returns: number;
      };
      can_access_hunt: {
        Args: { p_hunt_id: string; p_user_id: string };
        Returns: boolean;
      };
      are_users_blocked: {
        Args: { p_user_a: string; p_user_b: string };
        Returns: boolean;
      };
      expire_hunt_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      game_mode: GameMode;
      quest_type: QuestType;
      quest_status: QuestStatus;
      difficulty: Difficulty;
      hunt_type: HuntType;
      hunt_status: HuntStatus;
      hunt_privacy: HuntPrivacy;
      notification_type: NotificationType;
      report_status: ReportStatus;
      moderation_status: ModerationStatus;
    };
  };
}
