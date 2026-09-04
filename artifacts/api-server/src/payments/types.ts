export type PaymentProvider = "revenuecat" | "apple" | "google_play" | "stripe";
export type PaymentCategory = "membership" | "drop_credits" | "collectible";
export type CurrencyCode = string;

export type PaymentIntentStatus = "created" | "requires_action" | "processing" | "succeeded" | "failed" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "reversed";
export type RefundStatus = "requested" | "pending" | "succeeded" | "failed" | "reversed";
export type DisputeStatus = "opened" | "won" | "lost" | "chargeback" | "reversed";
export type SellerStatus = "not_onboarded" | "onboarding_required" | "pending" | "active" | "restricted" | "disabled";
export type PayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "reversed";

export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type PaymentIntent = {
  id: string;
  idempotencyKey: string;
  category: PaymentCategory;
  buyerUserId: string;
  amount: Money;
  status: PaymentIntentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
};

export type Payment = {
  id: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  category: PaymentCategory;
  buyerUserId: string;
  amount: Money;
  status: PaymentStatus;
  orderId: string | null;
};

export type Refund = {
  id: string;
  paymentId: string;
  provider: PaymentProvider;
  amount: Money;
  status: RefundStatus;
  providerRefundId: string | null;
};

export type Dispute = {
  id: string;
  paymentId: string;
  provider: PaymentProvider;
  amount: Money;
  status: DisputeStatus;
  providerDisputeId: string;
};

export type SellerAccount = {
  sellerUserId: string;
  provider: PaymentProvider;
  providerAccountId: string | null;
  status: SellerStatus;
  payoutsEnabled: boolean;
  requirementsDue: boolean;
};

export type Payout = {
  id: string;
  sellerUserId: string;
  provider: PaymentProvider;
  amount: Money;
  status: PayoutStatus;
  providerPayoutId: string | null;
};

export type NormalizedExternalEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  kind: "payment_succeeded" | "payment_failed" | "refund" | "dispute" | "payout";
  subjectType: "membership" | "drop_credits" | "marketplace_order" | "seller_account";
  subjectId: string | null;
  providerTransactionId: string | null;
  amount: Money | null;
  occurredAt: string;
  idempotencyKey: string;
};

export type ReconciliationSubject = {
  id: string;
  subjectType: NormalizedExternalEvent["subjectType"];
  provider: PaymentProvider | null;
  providerTransactionId: string | null;
  amount: Money | null;
};

export type ReconciliationStatus = "matched" | "duplicate" | "unmatched" | "mismatch";
export type ReconciliationIssueCode =
  | "duplicate_provider_event"
  | "unknown_external_event"
  | "subject_not_found"
  | "provider_mismatch"
  | "transaction_mismatch"
  | "amount_mismatch"
  | "currency_mismatch";

export type ReconciliationResult = {
  status: ReconciliationStatus;
  issueCode: ReconciliationIssueCode | null;
  providerEventId: string;
  subjectId: string | null;
  subjectType: NormalizedExternalEvent["subjectType"];
};