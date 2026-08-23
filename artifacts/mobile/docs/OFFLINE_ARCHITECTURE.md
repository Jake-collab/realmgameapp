# Offline Architecture

Worlds uses one shared offline layer for safe cache, mutation intent, local evidence, connectivity, sync, and conflicts. Offline state is scoped by authenticated user and versioned independently from server data.

Offline preserves intent and evidence; it never fabricates Quest/Hunt completion, points, location validation, clue unlocks, publication, moderation, or social safety success.