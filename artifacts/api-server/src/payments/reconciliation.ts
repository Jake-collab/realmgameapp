import type {
  NormalizedExternalEvent,
  ReconciliationResult,
  ReconciliationSubject,
} from "./types";
import type { ReconciliationMatcher } from "./ports";

function sameMoney(
  left: NormalizedExternalEvent["amount"],
  right: ReconciliationSubject["amount"],
  field: "amount" | "currency",
): boolean {
  if (!left || !right) return true;
  return field === "amount"
    ? left.amountMinor === right.amountMinor
    : left.currency.toUpperCase() === right.currency.toUpperCase();
}

export const reconciliationMatcher: ReconciliationMatcher = {
  match(event, subjects, seenProviderEventIds = new Set()) {
    if (seenProviderEventIds.has(`${event.provider}:${event.providerEventId}`)) {
      return {
        status: "duplicate",
        issueCode: "duplicate_provider_event",
        providerEventId: event.providerEventId,
        subjectId: event.subjectId,
        subjectType: event.subjectType,
      };
    }

    const subject = subjects.find((candidate) =>
      candidate.subjectType === event.subjectType
      && (
        (event.subjectId !== null && candidate.id === event.subjectId)
        || (
          event.subjectId === null
          && event.providerTransactionId !== null
          && candidate.provider === event.provider
          && candidate.providerTransactionId === event.providerTransactionId
        )
      ),
    );

    if (!subject) {
      return {
        status: event.subjectId === null ? "unmatched" : "mismatch",
        issueCode: event.subjectId === null ? "unknown_external_event" : "subject_not_found",
        providerEventId: event.providerEventId,
        subjectId: event.subjectId,
        subjectType: event.subjectType,
      };
    }
    if (subject.provider !== null && subject.provider !== event.provider) {
      return {
        status: "mismatch",
        issueCode: "provider_mismatch",
        providerEventId: event.providerEventId,
        subjectId: subject.id,
        subjectType: event.subjectType,
      };
    }
    if (
      event.providerTransactionId !== null
      && subject.providerTransactionId !== null
      && event.providerTransactionId !== subject.providerTransactionId
    ) {
      return {
        status: "mismatch",
        issueCode: "transaction_mismatch",
        providerEventId: event.providerEventId,
        subjectId: subject.id,
        subjectType: event.subjectType,
      };
    }
    if (!sameMoney(event.amount, subject.amount, "currency")) {
      return {
        status: "mismatch",
        issueCode: "currency_mismatch",
        providerEventId: event.providerEventId,
        subjectId: subject.id,
        subjectType: event.subjectType,
      };
    }
    if (!sameMoney(event.amount, subject.amount, "amount")) {
      return {
        status: "mismatch",
        issueCode: "amount_mismatch",
        providerEventId: event.providerEventId,
        subjectId: subject.id,
        subjectType: event.subjectType,
      };
    }
    return {
      status: "matched",
      issueCode: null,
      providerEventId: event.providerEventId,
      subjectId: subject.id,
      subjectType: event.subjectType,
    };
  },
};

export function reconcileExternalEvents(
  events: readonly NormalizedExternalEvent[],
  subjects: readonly ReconciliationSubject[],
  seenProviderEventIds: ReadonlySet<string> = new Set(),
): ReconciliationResult[] {
  const seen = new Set(seenProviderEventIds);
  return events.map((event) => {
    const result = reconciliationMatcher.match(event, subjects, seen);
    seen.add(`${event.provider}:${event.providerEventId}`);
    return result;
  });
}