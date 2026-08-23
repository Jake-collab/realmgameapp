# Worlds Push Notifications

Push delivery is provider-neutral. The server owns the `PushNotificationProvider` contract; Expo delivery is an adapter and can later be replaced with APNs/FCM without changing domain workflows.

Device rows are keyed by `(user_id, installation_id)`. Registration refreshes the token, account switching disables the previous association, and permanent provider invalidation disables the device rather than retrying forever.

The mobile permission flow is contextual. Users see why notifications help before the OS prompt. Denied permission is shown honestly with an Open Settings action where supported.

Provider credentials are server-only. Push payloads contain concise safe copy and typed destination metadata, never riddle answers, hidden coordinates, private proof, reporter identity, moderation scores, or anti-cheat signals.