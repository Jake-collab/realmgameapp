-- ============================================================
-- Migration 055 — Production scheduler leases and maintenance
-- Worlds — Build 1, Supabase blocker #5
-- ============================================================
-- The trusted API worker is the single scheduler for:
--   * durable notification events and scheduled notifications
--   * push delivery retries
--   * database-native maintenance
--
-- All worker RPCs are service_role-only. They are deliberately not
-- granted to anon/authenticated and must never be called by mobile code.
-- ============================================================

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_acquired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE scheduled_notifications
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_acquired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_acquired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_events_claimable
  ON notification_events (processing_status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_claimable
  ON scheduled_notifications (status, next_attempt_at, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_claimable
  ON notification_deliveries (status, next_attempt_at, created_at)
  WHERE channel = 'push';

-- A single durable ingress for immediate notification events. The unique
-- idempotency key makes retries safe before the worker has claimed the row.
CREATE OR REPLACE FUNCTION enqueue_notification_event(
  p_event_id UUID,
  p_idempotency_key TEXT,
  p_event_type TEXT,
  p_user_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_event_id IS NULL OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0
     OR p_event_type IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid notification event';
  END IF;

  INSERT INTO notification_events(event_id, idempotency_key, event_type, user_id, payload)
  VALUES (p_event_id, p_idempotency_key, p_event_type, p_user_id, COALESCE(p_payload, '{}'::JSONB))
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT id INTO v_id
  FROM notification_events
  WHERE idempotency_key = p_idempotency_key;
  RETURN v_id;
END;
$$;

-- A durable ingress for delayed notifications. The payload contains only
-- renderable notification data; the worker still applies the canonical copy
-- and metadata filtering before materialization.
CREATE OR REPLACE FUNCTION schedule_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_scheduled_for TIMESTAMPTZ,
  p_idempotency_key TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_user_id IS NULL OR p_notification_type IS NULL OR p_scheduled_for IS NULL
     OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'invalid scheduled notification';
  END IF;

  INSERT INTO scheduled_notifications(
    user_id, notification_type, entity_type, entity_id, scheduled_for,
    timezone, idempotency_key, payload
  )
  VALUES (
    p_user_id, p_notification_type, p_entity_type, p_entity_id, p_scheduled_for,
    COALESCE(NULLIF(p_timezone, ''), 'UTC'), p_idempotency_key, COALESCE(p_payload, '{}'::JSONB)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM scheduled_notifications
    WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;

-- Claim event rows atomically. FOR UPDATE SKIP LOCKED allows more than one
-- worker replica without duplicate database work; the lease makes a crashed
-- worker recoverable.
CREATE OR REPLACE FUNCTION claim_notification_events(
  p_worker_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_lease_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 5
) RETURNS TABLE(
  id UUID,
  event_id UUID,
  idempotency_key TEXT,
  event_type TEXT,
  user_id UUID,
  payload JSONB,
  attempt_count INTEGER,
  lease_token UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM notification_events e
    WHERE (
      e.processing_status = 'pending'
      OR (
        e.processing_status = 'processing'
        AND e.lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1))
      )
    )
      AND (e.next_attempt_at IS NULL OR e.next_attempt_at <= NOW())
      AND e.attempt_count < GREATEST(p_max_attempts, 1)
    ORDER BY e.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ),
  claimed AS (
    UPDATE notification_events e
    SET processing_status = 'processing',
        attempt_count = e.attempt_count + 1,
        lease_token = gen_random_uuid(),
        lease_acquired_at = NOW(),
        last_error = NULL
    FROM candidates c
    WHERE e.id = c.id
    RETURNING e.*
  )
  SELECT c.id, c.event_id, c.idempotency_key, c.event_type, c.user_id,
         c.payload, c.attempt_count, c.lease_token
  FROM claimed c;
END;
$$;

-- Claim delayed notifications using the same lease contract.
CREATE OR REPLACE FUNCTION claim_scheduled_notifications(
  p_worker_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_lease_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 5
) RETURNS TABLE(
  id UUID,
  user_id UUID,
  notification_type TEXT,
  payload JSONB,
  scheduled_for TIMESTAMPTZ,
  attempts INTEGER,
  idempotency_key TEXT,
  lease_token UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT s.id
    FROM scheduled_notifications s
    WHERE (
      (s.status = 'scheduled' AND s.scheduled_for <= NOW())
      OR (
        s.status = 'sending'
        AND s.lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1))
      )
    )
      AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= NOW())
      AND s.attempts < GREATEST(p_max_attempts, 1)
    ORDER BY s.scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ),
  claimed AS (
    UPDATE scheduled_notifications s
    SET status = 'sending',
        attempts = s.attempts + 1,
        lease_token = gen_random_uuid(),
        lease_acquired_at = NOW(),
        last_error = NULL
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.*
  )
  SELECT c.id, c.user_id, c.notification_type, c.payload, c.scheduled_for,
         c.attempts, c.idempotency_key, c.lease_token
  FROM claimed c;
END;
$$;

-- Translate the API event vocabulary into the canonical database enum while
-- preserving a safe generic fallback for future event types.
CREATE OR REPLACE FUNCTION notification_type_for_event(p_event_type TEXT)
RETURNS notification_type
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (
    CASE upper(COALESCE(p_event_type, ''))
      WHEN 'DAILY_QUEST_READY' THEN 'quest_available'
      WHEN 'MONTHLY_DROP_LIVE' THEN 'monthly_drop'
      WHEN 'HUNT_INVITATION' THEN 'hunt_invitation'
      WHEN 'HUNT_STARTING_SOON' THEN 'hunt_starting'
      WHEN 'HUNT_STARTED' THEN 'hunt_started'
      WHEN 'HUNT_PAUSED' THEN 'hunt_paused'
      WHEN 'HUNT_RESUMED' THEN 'hunt_resumed'
      WHEN 'HUNT_CANCELLED' THEN 'hunt_cancelled'
      WHEN 'HUNT_RESULTS_READY' THEN 'hunt_results_ready'
      WHEN 'PROOF_APPROVED' THEN 'proof_approved'
      WHEN 'PROOF_NEEDS_RESUBMISSION' THEN 'needs_resubmission'
      WHEN 'PROOF_REJECTED' THEN 'proof_rejected'
      WHEN 'POINTS_QUARANTINED' THEN 'points_quarantined'
      WHEN 'POINTS_RELEASED' THEN 'points_released'
      WHEN 'ACHIEVEMENT_UNLOCKED' THEN 'achievement_earned'
      WHEN 'FRIEND_REQUEST' THEN 'friend_request_received'
      WHEN 'FRIEND_ACCEPTED' THEN 'friend_request_accepted'
      WHEN 'REPORT_ACKNOWLEDGED' THEN 'report_acknowledged'
      WHEN 'ACCOUNT_SECURITY' THEN 'account_security'
      ELSE 'admin_message'
    END
  )::notification_type;
$$;

-- Materialize in-app history and push fanout in one transaction. Push status
-- is deliberately independent from the authoritative in-app row.
CREATE OR REPLACE FUNCTION materialize_notification(
  p_event_id UUID,
  p_idempotency_key TEXT,
  p_user_id UUID,
  p_event_type TEXT,
  p_category TEXT,
  p_title TEXT,
  p_body TEXT,
  p_deep_link TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_urgent BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_notification_id UUID;
  v_category TEXT := CASE WHEN p_category IN ('quest','hunt','social','progress','moderation','account','system')
                          THEN p_category ELSE 'system' END;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_event_id IS NULL OR p_idempotency_key IS NULL OR p_user_id IS NULL
     OR p_title IS NULL OR p_body IS NULL THEN
    RAISE EXCEPTION 'invalid notification materialization';
  END IF;

  INSERT INTO notifications(
    user_id, type, title, body, data, deep_link, category,
    domain_event_id, idempotency_key, target_type, target_id, metadata
  )
  VALUES (
    p_user_id,
    notification_type_for_event(p_event_type),
    left(p_title, 100),
    left(p_body, 500),
    COALESCE(p_metadata, '{}'::JSONB),
    p_deep_link,
    v_category,
    p_event_id,
    p_idempotency_key,
    p_target_type,
    p_target_id,
    COALESCE(p_metadata, '{}'::JSONB)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NULL THEN
    SELECT id INTO v_notification_id
    FROM notifications
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
  END IF;

  INSERT INTO notification_deliveries(
    notification_id, channel, device_id, status, attempt_count, created_at
  )
  VALUES (v_notification_id, 'in_app', NULL, 'delivered', 1, NOW())
  ON CONFLICT (notification_id, channel, device_id) DO NOTHING;

  INSERT INTO notification_deliveries(
    notification_id, channel, device_id, status, failure_category, created_at
  )
  SELECT
    v_notification_id,
    'push',
    d.id,
    CASE
      WHEN COALESCE(p.push_enabled, TRUE) = FALSE THEN 'suppressed'
      WHEN v_category = 'quest' AND COALESCE(p.quest_enabled, TRUE) = FALSE THEN 'suppressed'
      WHEN v_category = 'hunt' AND COALESCE(p.hunt_enabled, TRUE) = FALSE THEN 'suppressed'
      WHEN v_category = 'social' AND COALESCE(p.social_enabled, TRUE) = FALSE THEN 'suppressed'
      WHEN v_category = 'progress' AND COALESCE(p.progress_enabled, TRUE) = FALSE THEN 'suppressed'
      WHEN NOT p_urgent AND COALESCE(p.quiet_hours_enabled, FALSE)
       AND (
         (p.quiet_hours_start = p.quiet_hours_end)
         OR (
           CASE WHEN p.quiet_hours_start < p.quiet_hours_end
             THEN (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME >= p.quiet_hours_start
               AND (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME < p.quiet_hours_end
             ELSE (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME >= p.quiet_hours_start
               OR (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME < p.quiet_hours_end
           END
         )
       ) THEN 'suppressed'
      ELSE 'queued'
    END,
    CASE
      WHEN COALESCE(p.push_enabled, TRUE) = FALSE
        OR (v_category = 'quest' AND COALESCE(p.quest_enabled, TRUE) = FALSE)
        OR (v_category = 'hunt' AND COALESCE(p.hunt_enabled, TRUE) = FALSE)
        OR (v_category = 'social' AND COALESCE(p.social_enabled, TRUE) = FALSE)
        OR (v_category = 'progress' AND COALESCE(p.progress_enabled, TRUE) = FALSE)
        OR (NOT p_urgent AND COALESCE(p.quiet_hours_enabled, FALSE) AND (
          p.quiet_hours_start = p.quiet_hours_end
          OR CASE WHEN p.quiet_hours_start < p.quiet_hours_end
            THEN (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME >= p.quiet_hours_start
              AND (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME < p.quiet_hours_end
            ELSE (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME >= p.quiet_hours_start
              OR (NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::TIME < p.quiet_hours_end
          END
        )) THEN 'preference_or_quiet_hours' ELSE NULL
    END,
    NOW()
  FROM push_devices d
  LEFT JOIN notification_preferences p ON p.user_id = d.user_id
  WHERE d.user_id = p_user_id AND d.enabled = TRUE
  ON CONFLICT (notification_id, channel, device_id) DO NOTHING;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION complete_notification_event(
  p_event_id UUID,
  p_lease_token UUID,
  p_notification JSONB,
  p_retry_at TIMESTAMPTZ DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event notification_events%ROWTYPE;
  v_notification_id UUID;
  v_failed BOOLEAN := p_notification IS NULL;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  SELECT * INTO v_event FROM notification_events
  WHERE id = p_event_id AND processing_status = 'processing' AND lease_token = p_lease_token
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'lease_lost');
  END IF;

  IF NOT v_failed THEN
    v_notification_id := materialize_notification(
      v_event.event_id,
      v_event.idempotency_key,
      v_event.user_id,
      v_event.event_type,
      COALESCE(p_notification->>'category', 'system'),
      left(COALESCE(p_notification->>'title', 'You have an update in Worlds'), 100),
      left(COALESCE(p_notification->>'body', 'Open Worlds to see what changed.'), 500),
      p_notification->>'deepLink',
      p_notification->>'targetType',
      NULLIF(p_notification->>'targetId', '')::UUID,
      COALESCE(p_notification->'metadata', '{}'::JSONB),
      COALESCE((p_notification->>'urgent')::BOOLEAN, FALSE)
    );
    UPDATE notification_events
    SET processing_status = 'processed', processed_at = NOW(),
        lease_token = NULL, lease_acquired_at = NULL, next_attempt_at = NULL, last_error = NULL
    WHERE id = p_event_id;
    RETURN jsonb_build_object('accepted', true, 'notificationId', v_notification_id);
  END IF;

  UPDATE notification_events
  SET processing_status = CASE WHEN attempt_count >= 5 THEN 'failed' ELSE 'pending' END,
      lease_token = NULL, lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN attempt_count >= 5 THEN NULL ELSE COALESCE(p_retry_at, NOW() + INTERVAL '1 minute') END,
      last_error = left(COALESCE(p_error, 'notification_processing_failed'), 500)
  WHERE id = p_event_id;
  RETURN jsonb_build_object('accepted', true, 'failed', true);
END;
$$;

CREATE OR REPLACE FUNCTION complete_scheduled_notification(
  p_id UUID,
  p_lease_token UUID,
  p_status TEXT,
  p_retry_at TIMESTAMPTZ DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_status NOT IN ('sent', 'suppressed', 'failed') THEN
    RAISE EXCEPTION 'invalid scheduled notification status';
  END IF;
  UPDATE scheduled_notifications
  SET status = CASE WHEN p_status = 'failed' AND attempts < 5 THEN 'scheduled' ELSE p_status END,
      lease_token = NULL,
      lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN p_status = 'failed' AND attempts < 5
                             THEN COALESCE(p_retry_at, NOW() + INTERVAL '1 minute') ELSE NULL END,
      last_error = CASE WHEN p_status = 'failed' THEN left(COALESCE(p_error, 'scheduled_notification_failed'), 500) ELSE NULL END
  WHERE id = p_id AND status = 'sending' AND lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION claim_notification_deliveries(
  p_worker_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_lease_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 3
) RETURNS TABLE(
  id UUID,
  notification_id UUID,
  device_id UUID,
  token TEXT,
  title TEXT,
  body TEXT,
  deep_link TEXT,
  attempt_count INTEGER,
  lease_token UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT d.id
    FROM notification_deliveries d
    WHERE d.channel = 'push'
      AND (
        (d.status = 'queued' AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= NOW()))
        OR (
          d.status = 'sending'
          AND d.lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1))
        )
      )
      AND d.attempt_count < GREATEST(p_max_attempts, 1)
    ORDER BY d.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
  ),
  claimed AS (
    UPDATE notification_deliveries d
    SET status = 'sending',
        attempt_count = d.attempt_count + 1,
        lease_token = gen_random_uuid(),
        lease_acquired_at = NOW(),
        last_attempt_at = NOW()
    FROM candidates c
    WHERE d.id = c.id
    RETURNING d.*
  )
  SELECT c.id, c.notification_id, c.device_id, pd.push_token,
         n.title, n.body, n.deep_link, c.attempt_count, c.lease_token
  FROM claimed c
  JOIN notifications n ON n.id = c.notification_id
  LEFT JOIN push_devices pd ON pd.id = c.device_id;
END;
$$;

CREATE OR REPLACE FUNCTION complete_notification_delivery(
  p_id UUID,
  p_lease_token UUID,
  p_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_failure_category TEXT DEFAULT NULL,
  p_retry_at TIMESTAMPTZ DEFAULT NULL,
  p_disable_device BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device_id UUID;
  v_attempt_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_status NOT IN ('sent', 'failed', 'queued', 'suppressed') THEN
    RAISE EXCEPTION 'invalid delivery status';
  END IF;
  SELECT device_id, attempt_count INTO v_device_id, v_attempt_count
  FROM notification_deliveries
  WHERE id = p_id AND status = 'sending' AND lease_token = p_lease_token
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE notification_deliveries
  SET status = CASE WHEN p_status = 'queued' AND v_attempt_count >= 3 THEN 'failed' ELSE p_status END,
      provider_message_id = p_provider_message_id,
      failure_category = p_failure_category,
      lease_token = NULL,
      lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN p_status = 'queued' AND v_attempt_count < 3 THEN p_retry_at ELSE NULL END
  WHERE id = p_id;

  IF p_disable_device AND v_device_id IS NOT NULL THEN
    UPDATE push_devices
    SET enabled = FALSE, invalidated_at = NOW(), updated_at = NOW()
    WHERE id = v_device_id;
  END IF;
  RETURN TRUE;
END;
$$;

-- Explicit restart recovery is observable and safe to run repeatedly. Claim
-- functions also recover stale rows, so this is a fast diagnostic/repair pass.
CREATE OR REPLACE FUNCTION recover_notification_work(
  p_lease_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 3
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_events INTEGER;
  v_scheduled INTEGER;
  v_deliveries INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  UPDATE notification_events
  SET processing_status = CASE WHEN attempt_count >= 5 THEN 'failed' ELSE 'pending' END,
      lease_token = NULL, lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN attempt_count >= 5 THEN NULL ELSE NOW() END,
      last_error = COALESCE(last_error, 'recovered_stale_worker_lease')
  WHERE processing_status = 'processing'
    AND lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1));
  GET DIAGNOSTICS v_events = ROW_COUNT;

  UPDATE scheduled_notifications
  SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'scheduled' END,
      lease_token = NULL, lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN attempts >= 5 THEN NULL ELSE NOW() END,
      last_error = COALESCE(last_error, 'recovered_stale_worker_lease')
  WHERE status = 'sending'
    AND lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1));
  GET DIAGNOSTICS v_scheduled = ROW_COUNT;

  UPDATE notification_deliveries
  SET status = CASE WHEN attempt_count >= GREATEST(p_max_attempts, 1) THEN 'failed' ELSE 'queued' END,
      lease_token = NULL, lease_acquired_at = NULL,
      next_attempt_at = CASE WHEN attempt_count >= GREATEST(p_max_attempts, 1) THEN NULL ELSE NOW() END,
      failure_category = COALESCE(failure_category, 'recovered_stale_worker_lease')
  WHERE channel = 'push'
    AND status = 'sending'
    AND lease_acquired_at < NOW() - make_interval(secs => GREATEST(p_lease_seconds, 1));
  GET DIAGNOSTICS v_deliveries = ROW_COUNT;

  RETURN jsonb_build_object(
    'events', v_events,
    'scheduled', v_scheduled,
    'deliveries', v_deliveries
  );
END;
$$;

-- Build 1 explicitly documents Quest expiry as scheduled server work.
CREATE OR REPLACE FUNCTION expire_quest_participations()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;
  UPDATE quest_participations
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('started', 'in_progress', 'awaiting_proof', 'needs_resubmission')
    AND expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Expired one-time sessions contain no reusable authority. Rows referenced by
-- proof/collection/placement records are protected by their existing RESTRICT
-- foreign keys, so this cleanup cannot remove audit evidence.
CREATE OR REPLACE FUNCTION purge_expired_ephemeral_sessions()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_verification INTEGER;
  v_collection INTEGER;
  v_placement INTEGER;
  v_sweep INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;
  DELETE FROM quest_proof_verification_sessions
  WHERE consumed_at IS NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_verification = ROW_COUNT;
  DELETE FROM hunt_drop_collection_sessions
  WHERE consumed_at IS NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_collection = ROW_COUNT;
  DELETE FROM hunt_placement_sessions
  WHERE consumed_at IS NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_placement = ROW_COUNT;
  DELETE FROM hunt_creator_stop_sweep_sessions
  WHERE consumed_at IS NULL AND expires_at <= NOW();
  GET DIAGNOSTICS v_sweep = ROW_COUNT;
  RETURN jsonb_build_object(
    'verification', v_verification,
    'collection', v_collection,
    'placement', v_placement,
    'creator_sweep', v_sweep
  );
END;
$$;

-- One worker-facing maintenance entry point. There is intentionally no
-- pg_cron registration; this function is called by the trusted worker only.
CREATE OR REPLACE FUNCTION run_scheduled_maintenance()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation INTEGER;
  v_coordinates INTEGER;
  v_participations INTEGER;
  v_sessions JSONB;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;
  v_invitation := expire_hunt_invitations();
  v_coordinates := purge_expired_validation_coordinates();
  v_participations := expire_quest_participations();
  v_sessions := purge_expired_ephemeral_sessions();
  RETURN jsonb_build_object(
    'invitations_expired', v_invitation,
    'coordinates_purged', v_coordinates,
    'quest_participations_expired', v_participations,
    'ephemeral_sessions', v_sessions
  );
END;
$$;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_notification_event', 'schedule_notification',
        'claim_notification_events', 'claim_scheduled_notifications',
        'notification_type_for_event', 'materialize_notification',
        'complete_notification_event', 'complete_scheduled_notification',
        'claim_notification_deliveries', 'complete_notification_delivery',
        'recover_notification_work', 'expire_quest_participations',
        'purge_expired_ephemeral_sessions', 'run_scheduled_maintenance'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END;
$$;
