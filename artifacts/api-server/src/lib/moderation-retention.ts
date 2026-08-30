export const MODERATION_RETENTION_FAILURE_CLASSIFICATION = {
  BLOCKED_REFERENCE: "blocked_reference",
  RETRYABLE: "retryable",
} as const;

export type ModerationRetentionFailureClassification =
  (typeof MODERATION_RETENTION_FAILURE_CLASSIFICATION)[keyof typeof MODERATION_RETENTION_FAILURE_CLASSIFICATION];
