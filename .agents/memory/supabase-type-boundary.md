---
name: Supabase type boundary
description: The disconnected mobile app keeps domain types local and isolates the partial pre-connection schema at the Supabase client boundary.
---

The mobile app uses one canonical local schema source for service/domain types. The SDK client remains untyped at the connection boundary until Supabase-generated types are available.

**Why:** Supabase's strict generic query builder turns incomplete hand-maintained schemas into `never`, causing broad cascades of false application errors before a project is connected.

**How to apply:** When the Supabase project is connected, regenerate the schema types from the live database and restore strict SDK typing incrementally; do not maintain a second placeholder schema.