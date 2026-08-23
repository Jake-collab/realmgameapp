# Prompt 20 Moderation and Integrity Architecture

## Safety boundary

Moderation providers are called only by trusted server code. Provider secrets, category scores, internal reasons, integrity scores, VPN signals, mock-location signals, and exact validation coordinates are never returned to ordinary users.

Automation may approve narrowly defined low-risk public content when explicitly configured, or route content to warning, quarantine, or human review. It never permanently bans, permanently suspends, deletes evidence, reverses major rewards, or rejects ambiguous safety-sensitive cases without a trusted review path.

## Provider and policy layers

The provider abstraction normalizes image, text, and health responses into Worlds categories and decisions. The platform policy layer then considers content context, public/private visibility, proof status, account standing, reports, and prior severe moderation history. Provider output is never treated as the final product decision.

When automation is disabled or unavailable, public content remains pending/manual-review and private proof remains available to the proof queue with moderation marked unavailable. Uploads are not deleted.

## Media and proof

Public media is private until the normalized policy result permits publication. Proof media remains private. Safety moderation and proof validity are separate states: safe media can be invalid proof, and relevant proof can still require safety review. Content hashes support idempotency and duplicate-media signals but do not prove fraud by themselves.

## Reports and integrity

Report triage normalizes reason, detects duplicate/related reports, and calculates explainable priority without exposing reporter identity or automatically sanctioning the target. The canonical integrity engine evaluates mock-location, accuracy, speed, burst, duplicate participation/media, VPN, geo failures, riddle abuse, time ordering, and server timestamp signals. VPN and ordinary GPS noise are weak signals; high risk recommends review or reward quarantine rather than permanent enforcement.

Risk snapshots include a policy version and are immutable. Quarantined rewards must remain excluded from spendable and leaderboard totals until a trusted release or append-only reversal operation resolves them.

## Privacy and retention

Anti-cheat uses only submitted validation events and necessary timestamps. It does not collect browsing coordinates, reconstruct routes, or create continuous surveillance. Exact coordinates and rejected media follow configured retention cleanup while preserving derived decisions and active-case evidence.

## Operational requirements

Every scan and moderation action uses an idempotency key derived from the media/content version, content hash, and policy version. Cases support claiming with optimistic concurrency, manual overrides, appeals metadata, and append-only audit events. Diagnostics report configured/reachable status and quality metrics without secrets or invented counts.

The local development stub is enabled only outside production through an explicit environment variable. Production never silently falls back to the stub.