# Offline Storage

AsyncStorage stores versioned, user-scoped JSON for lightweight cache metadata and the durable mutation queue. Local proof/media records store app-private file URI references and metadata, never base64 binaries in AsyncStorage. Sensitive server tokens, hidden Hunt content, private geometry, moderation provider data, and service-role data are excluded.