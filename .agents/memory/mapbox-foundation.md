---
name: Mapbox foundation boundary
description: Shared mobile map behavior, privacy-safe camera persistence, and Hunt RPC identity enforcement.
---

Public map screens may use only validated approximate coordinates and bounded viewport requests. Persisted camera state is coarse and capped, never raw validation GPS. Hunt map RPCs must derive user context from `auth.uid()` through a security wrapper rather than trusting a client UUID.

**Why:** Map browsing is public-facing, but participation context and validation geometry are sensitive. Client payloads and legacy RPC signatures cannot be treated as trusted identity or coordinate validation.

**How to apply:** Keep Quest and Hunt rendering on shared validated event/camera helpers, preserve public/private coordinate separation, and add new RPC hardening additively after the existing migration history.