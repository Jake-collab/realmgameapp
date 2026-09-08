---
name: Mapbox foundation boundary
description: Shared mobile map behavior, privacy-safe camera persistence, and Hunt RPC identity enforcement.
---

Public map screens may use only validated approximate coordinates and bounded viewport requests. Persisted camera state is coarse and capped, never raw validation GPS. Active Hunt objective markers must use a separate participant-authorized public-location projection; never copy validation geometry into the active Hunt payload. Hunt map RPCs must derive user context from `auth.uid()` through a security wrapper rather than trusting a client UUID.

**Why:** Map browsing is public-facing, but participation context and validation geometry are sensitive. Client payloads and legacy RPC signatures cannot be treated as trusted identity or coordinate validation. Keeping revealed display coordinates separate also prevents a future active-Hunt query change from accidentally widening access to locked or private geometry.

**How to apply:** Keep Quest and Hunt rendering on shared validated event/camera helpers, preserve public/private coordinate separation, and add new RPC hardening additively after the existing migration history. Expose only revealed stops with public lat/lng/radius; keep server-side geofences and locked stops out of client responses. In PostgreSQL `RETURNS TABLE` map projections, cast integer/numeric source columns explicitly to the declared result types; row-return queries require exact types rather than relying on implicit coercion.