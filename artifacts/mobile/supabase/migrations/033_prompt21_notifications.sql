-- Prompt 21: notification delivery, device lifecycle, preferences and scheduling.
-- Gameplay remains authoritative; notification rows are derived engagement records.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quest_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quest_expiring';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quest_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'points_awarded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'points_quarantined';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'points_released';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hunt_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hunt_paused';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hunt_resumed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hunt_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hunt_results_ready';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_request_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_request_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'report_acknowledged';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_security';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS domain_event_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_category_check CHECK (category IN ('quest','hunt','social','progress','moderation','account','system'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_active ON notifications (user_id, created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  hunt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  progress_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  social_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  show_details BOOLEAN NOT NULL DEFAULT TRUE,
  daily_reminder_time TIME NOT NULL DEFAULT '09:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  app_version TEXT,
  device_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  invalidated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, installation_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_devices_token ON push_devices (push_token);
CREATE INDEX IF NOT EXISTS idx_push_devices_user_enabled ON push_devices (user_id) WHERE enabled;

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','push')),
  device_id UUID REFERENCES push_devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('scheduled','queued','sending','sent','delivered','failed','cancelled','suppressed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  failure_category TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, channel, device_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries (status, created_at);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','queued','sending','sent','cancelled','suppressed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due ON scheduled_notifications (status, scheduled_for);

CREATE OR REPLACE FUNCTION register_push_device(
  p_installation_id TEXT, p_push_token TEXT, p_platform TEXT, p_app_version TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS push_devices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result push_devices;
BEGIN
  IF auth.uid() IS NULL OR p_installation_id IS NULL OR length(trim(p_installation_id)) = 0 OR length(trim(p_push_token)) = 0 THEN
    RAISE EXCEPTION 'invalid device registration';
  END IF;
  UPDATE push_devices SET enabled = FALSE, invalidated_at = NOW(), updated_at = NOW()
    WHERE push_token = p_push_token AND user_id <> auth.uid();
  INSERT INTO push_devices(user_id, installation_id, push_token, platform, app_version, device_metadata)
  VALUES(auth.uid(), p_installation_id, p_push_token, p_platform, p_app_version, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, installation_id) DO UPDATE SET push_token = EXCLUDED.push_token, platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version, device_metadata = EXCLUDED.device_metadata, enabled = TRUE, invalidated_at = NULL,
    last_used_at = NOW(), updated_at = NOW()
  RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION unregister_push_device(p_installation_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE push_devices SET enabled = FALSE, updated_at = NOW()
  WHERE user_id = auth.uid() AND installation_id = p_installation_id;
$$;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read_at = COALESCE(read_at, NOW())
  WHERE id = p_notification_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read_at = COALESCE(read_at, NOW())
  WHERE user_id = auth.uid() AND read_at IS NULL AND archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION update_notification_preferences(p_preferences JSONB)
RETURNS notification_preferences LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result notification_preferences;
BEGIN
  INSERT INTO notification_preferences(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE notification_preferences SET
    push_enabled = COALESCE((p_preferences->>'pushEnabled')::BOOLEAN, push_enabled),
    quest_enabled = COALESCE((p_preferences->>'questEnabled')::BOOLEAN, quest_enabled),
    hunt_enabled = COALESCE((p_preferences->>'huntEnabled')::BOOLEAN, hunt_enabled),
    progress_enabled = COALESCE((p_preferences->>'progressEnabled')::BOOLEAN, progress_enabled),
    social_enabled = COALESCE((p_preferences->>'socialEnabled')::BOOLEAN, social_enabled),
    quiet_hours_enabled = COALESCE((p_preferences->>'quietHoursEnabled')::BOOLEAN, quiet_hours_enabled),
    quiet_hours_start = COALESCE((p_preferences->>'quietHoursStart')::TIME, quiet_hours_start),
    quiet_hours_end = COALESCE((p_preferences->>'quietHoursEnd')::TIME, quiet_hours_end),
    timezone = COALESCE(NULLIF(p_preferences->>'timezone',''), timezone),
    show_details = COALESCE((p_preferences->>'showDetails')::BOOLEAN, show_details),
    updated_at = NOW()
  WHERE user_id = auth.uid() RETURNING * INTO result;
  RETURN result;
END; $$;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_owner ON notification_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_devices_owner ON push_devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_owner_update ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON FUNCTION register_push_device(TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION unregister_push_device(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_push_device(TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION unregister_push_device(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION update_notification_preferences(JSONB) TO authenticated;