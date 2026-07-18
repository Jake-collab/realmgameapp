# Database Architecture — Worlds

Build 1, Prompt 3. Apply migrations in `supabase/migrations/` before reading this document.

---

## Entity-Relationship Summary

```
auth.users (Supabase Auth)
    │ 1:1
    ▼
profiles ──────────────────────────── user_settings
    │ 1:1                                  │
    │                                      └─ onboarding_progress (JSONB)
    │ N:M
user_interests ──────────────── interests

profiles
    │ 1:N
    ├── quest_participations ───── quests
    │       │ 1:N                     │ 1:N
    │       ├── quest_step_progress   ├── quest_objectives
    │       └── proof_submissions     ├── quest_categories (via quest_category_assignments)
    │                                 ├── quest_locations  (public, approximate)
    │                                 ├── quest_geofences  (PRIVATE, server-only)
    │                                 └── quest_media ──── media_assets
    │
    ├── hunt_participants ──────── hunts
    │       │ 1:N                     │ 1:N
    │       └── hunt_stop_progress    ├── hunt_stops
    │               │                 │       │ 1:N
    │               └─ proof_submissions      ├── hunt_clues
    │                                         └── hunt_stop_geofences (PRIVATE)
    │
    ├── hunt_invitations ─────────── hunts
    │
    ├── points_ledger (append-only)
    ├── user_achievements ──── achievements
    ├── notifications
    ├── reports
    └── user_blocks

media_assets (centralized)
    └── referenced by: quest_media, hunt_stops (cover), proof_media, reports

AI Foundation (inactive):
    ai_prompt_templates → ai_prompt_versions
    ai_generation_requests → ai_generated_content → quests / hunts
```

---

## Main Entities

### User Identity
| Table | Purpose |
|---|---|
| `profiles` | Public identity (username, display_name, avatar). 1:1 with `auth.users`. |
| `user_settings` | Private preferences (notifications, privacy, theme, onboarding state). |
| `user_interests` | Many-to-many: user → interest tag. |
| `interests` | Admin-managed interest taxonomy. |
| `reserved_usernames` | Usernames that cannot be registered. |

### Quest System
| Table | Purpose |
|---|---|
| `quests` | Quest content (daily, monthly, geo). Published only visible to clients. |
| `quest_objectives` | Ordered steps within a quest. |
| `quest_categories` | Admin taxonomy for filtering and AI generation. |
| `quest_tags` | Flexible tag assignments. |
| `quest_locations` | **Public, approximate** location for geo-quest map display. |
| `quest_geofences` | **PRIVATE.** Precise GPS validation geometry. Server-only. |
| `quest_media` | Quest ↔ media_assets ordered relation. |
| `point_reward_guidelines` | Configurable calibration reference for quest point values. |

### Participation and Proof
| Table | Purpose |
|---|---|
| `quest_participations` | User ↔ quest relationship and lifecycle status. |
| `quest_step_progress` | Per-step completion state within a participation. |
| `proof_submissions` | Shared proof system for quests and hunts. |
| `proof_media` | Proof ↔ media_assets relation. |

### Hunt System
| Table | Purpose |
|---|---|
| `hunts` | Hunt content (official, custom, community-reserved). |
| `hunt_stops` | Ordered or unordered stops along a hunt route. |
| `hunt_clues` | Clues and hints per stop. Unrevealed clues not sent to clients. |
| `hunt_stop_geofences` | **PRIVATE.** Precise stop coordinates. Server-only. |
| `hunt_participants` | User membership records for a hunt. |
| `hunt_invitations` | Invitation lifecycle. Reporter identity protected. |
| `hunt_stop_progress` | Per-participant stop completion. Server sets `completed_at`. |

### Points and Progress
| Table / View | Purpose |
|---|---|
| `points_ledger` | Append-only financial-grade points record. Never delete rows. |
| `user_point_totals` | View derived from ledger. Authoritative balance source. |
| `leaderboard_global` | All-time leaderboard view. |
| `leaderboard_monthly` | Rolling 30-day leaderboard view. |
| `leaderboard_quest` | Quest-reward leaderboard view. |
| `leaderboard_hunt` | Hunt-reward leaderboard view. |
| `achievements` | Admin-managed achievement definitions. |
| `user_achievements` | Earned achievement records. |

### Safety and Moderation
| Table | Purpose |
|---|---|
| `notifications` | In-app notification records. Owner-only. |
| `reports` | Safety reports against any entity type. Reporter identity protected. |
| `user_blocks` | Block relationships. |
| `moderation_cases` | Content and user moderation workflow records. |
| `audit_logs` | Append-only admin action history. |

### Media
| Table | Purpose |
|---|---|
| `media_assets` | Centralised registry for all uploaded files. |

### AI Foundation (inactive)
| Table | Purpose |
|---|---|
| `ai_prompt_templates` | Versioned prompt instructions. Inactive until activated. |
| `ai_prompt_versions` | Immutable version history. |
| `ai_generation_requests` | Per-generation job records. |
| `ai_generated_content` | AI-drafted content. Never auto-published. |

---

## Public vs Private Data Boundaries

### Always public (via RLS + views)
- `public_profiles` view — safe subset of `profiles` for active accounts
- Published + available quests
- Quest categories, tags, objectives, public locations
- Public and unlisted hunts (ready/active/scheduled)
- Active interests list
- Achievements (non-hidden)
- Leaderboard views (respects `leaderboard_visibility` setting)

### Owner-only (RLS-enforced)
- `user_settings` — full settings row
- `quest_participations` — own rows only
- `hunt_participants` — own rows only
- `hunt_invitations` — inviter sees own, invitee sees own
- `points_ledger` — own rows only
- `notifications` — own rows only
- `reports` — own reports only (status, not resolution)
- `user_blocks` — own blocks only
- `media_assets` — own assets, plus publicly approved assets

### Server-only (no RLS SELECT policies — service_role only)
- `quest_geofences` — precise GPS validation geometry
- `hunt_stop_geofences` — precise stop coordinates
- `moderation_cases` — full moderation records
- `audit_logs` — admin action history
- All AI tables

### Never accessible to clients
- `auth.users` private fields (email, encrypted_password)
- `SUPABASE_SERVICE_ROLE_KEY`
- `quest_geofences.validation_point`
- `hunt_stop_geofences.validation_point`
- `hunt_clues.hint_text` (until server reveals it)

---

## Design Decisions

**Why an append-only points ledger?**
A mutable `total_points` column can drift under concurrent writes, retries, or bugs.
The append-only ledger is the single source of truth. Totals are always derived via the
`user_point_totals` view. Mistakes are corrected with reversal transactions.

**Why shared proof infrastructure?**
Quest and Hunt proofs share identical lifecycle states, moderation requirements, and
storage policies. Duplicating tables would split moderation logic and make future
rule changes inconsistent.

**Why PostGIS?**
Geo-Quest radius checks and Hunt stop arrival validation require geospatial distance
calculations. Plain FLOAT latitude/longitude cannot perform `ST_DWithin` checks efficiently
at scale. PostGIS is the standard solution.

**Why AI tables are inactive by default?**
AI-generated content requires human review before it can be published. Tables exist so
the schema is ready when AI integration is activated, without creating auto-publish paths.
