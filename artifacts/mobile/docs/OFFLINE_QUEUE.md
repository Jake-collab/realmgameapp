# Offline Queue

Only explicitly approved safe intents may enter the queue. Each item has an owner, entity, deterministic idempotency key, dependencies, attempts, conflict strategy, and user-safe error state. Queue processing is bounded and dependency-first; permanent failures become “Needs your attention.”