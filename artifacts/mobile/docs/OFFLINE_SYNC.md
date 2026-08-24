# Offline Sync

Sync runs on foreground, connectivity recovery, authentication restoration, and manual request. It revalidates the account before processing each protected intent, executes dependencies first, refreshes affected queries, and never treats a lost response as proof of authoritative success.

Queue writes for one account are serialized so an autosave, a retry, and a reconnect cycle cannot overwrite one another. Retryable work uses capped exponential backoff. Items that need attention remain visible in Offline & Sync, where the user can retry after fixing a temporary issue or discard a no-longer-needed local intent.