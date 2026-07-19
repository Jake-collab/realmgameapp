# Quest Scheduling — Worlds

## Design Principles

1. **Server time is authoritative** — availability decisions are made server-side (DB `NOW()`, Edge Function time). The mobile client's clock is used only for display purposes.
2. **All timestamps are UTC ISO 8601** — stored in PostgreSQL as `TIMESTAMPTZ`, transferred as ISO strings. Never store local-timezone-ambiguous timestamps.
3. **Occurrence keys are deterministic** — given a quest slug and a UTC date/month, the key is always the same string. This enables idempotent lookups.
4. **Stable ordering** — daily/monthly quest selection uses `home_priority DESC, available_from DESC`. Never use randomness for primary ordering.

---

## Daily Quest Schedule

### Availability Window

Each daily quest is available from `available_from` (e.g., `2026-07-19T00:00:00Z`) to `available_until` (e.g., `2026-07-20T00:00:00Z`). This is exactly one UTC calendar day.

### Occurrence Keys

```
daily:{quest-slug}:{YYYY-MM-DD}
Example: daily:morning-walk:2026-07-19
```

The key is based on the **UTC date when the participation is created**. If a user starts at 23:55 UTC on the 19th, their occurrence key is `2026-07-19`.

### Participation Expiry

Daily quest participations expire at the end of the UTC calendar day or after `DAILY_QUEST_PARTICIPATION_EXPIRY_HOURS` (24h), whichever is earlier. They also expire if `quest.available_until` arrives first.

### Reset Mechanism

Daily quests reset for the next day by creating a new occurrence record (or being re-evaluated by the availability window). There is no "reset" event — the new UTC date automatically makes the previous day's occurrence key invalid for new starts.

---

## Monthly Quest Schedule

### Availability Window

Monthly quests are available for the entire calendar month (UTC). `available_from = first day of month 00:00:00Z`, `available_until = first day of next month 00:00:00Z`.

### Occurrence Keys

```
monthly:{quest-slug}:{YYYY-MM}
Example: monthly:city-explorer:2026-07
```

### Participation Expiry

Monthly participations expire when `quest.available_until` arrives (end of month). Users who started before the deadline may continue under `expiration_behavior = 'started_users_may_finish'`.

---

## Geo Quest Schedule

### Availability Window

Geo quests have admin-set `available_from` and `available_until` (e.g., 30-day windows). There is no automatic daily or monthly reset.

### Occurrence Keys

```
geo:{quest-slug}
Example: geo:riverside-mural
```

For non-repeatable geo quests, the occurrence key is static — it's just the slug prefix. For repeatable geo quests, the cooldown (`repeat_cooldown_hours`) gates re-entry rather than an occurrence key rotation.

### Participation Expiry

Geo quest participations expire at `min(expires_at, quest.available_until)`. The default is `GEO_QUEST_PARTICIPATION_EXPIRY_DAYS` (7 days) after start if no other deadline applies.

---

## Scheduling Helper Reference

All functions are in `features/quests/services/questScheduling.service.ts`.

| Function | Purpose |
|----------|---------|
| `buildDailyOccurrenceKey(slug, utcDate)` | Generate daily occurrence key |
| `buildMonthlyOccurrenceKey(slug, utcDate)` | Generate monthly occurrence key |
| `buildGeoOccurrenceKey(slug)` | Generate geo occurrence key |
| `buildOccurrenceKey(quest, now)` | Dispatch to correct builder by quest type |
| `isWithinAvailabilityWindow(quest, now)` | Check if quest is currently open |
| `isUpcoming(quest, now)` | Check if quest has not yet started |
| `isAvailabilityExpired(quest, now)` | Check if quest window has closed |
| `isOccurrenceActive(occurrence, now)` | Check if a specific occurrence is live |
| `calculateParticipationExpiry(quest, start)` | Compute participation deadline |
| `isParticipationExpired(expiresAt, now)` | Check if participation deadline passed |
| `checkRepeatCooldown(lastCompleted, hours, now)` | Evaluate repeat cooldown |
| `currentUtcDay(now)` | UTC start/end of current calendar day |
| `currentUtcMonth(now)` | UTC start/end of current calendar month |
| `formatCountdown(targetIso, now)` | Human-readable time remaining |

---

## Occurrence Table vs. Availability Window

The `quest_occurrences` table is used for **repeatable quest instances** that need their own metadata (admin priority override, reward override, publishable independently).

For simple repeatable quests without occurrence-level customization, the occurrence key is computed from the quest's own `available_from/available_until` window and the user's start time — no row in `quest_occurrences` is required.

The `questStart.service.ts` falls back gracefully when no occurrence record exists.

---

## Time Zone Display

All display-layer time conversion is done by `formatLocalTime(isoString)` which uses the device's local time zone. This is correct — the user sees their local time in the UI, but the server always works in UTC.

```typescript
// ✅ Correct
formatLocalTime('2026-07-19T23:59:59Z') // Shows "Jul 19, 11:59 PM" (local)

// ❌ Wrong — never store local-time strings without offset
new Date().toLocaleString() // Ambiguous
```
