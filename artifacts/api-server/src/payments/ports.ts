import type {
  Dispute,
  NormalizedExternalEvent,
  Payment,
  PaymentIntent,
  PaymentProvider,
  Payout,
  Refund,
  ReconciliationResult,
  ReconciliationSubject,
  SellerAccount,
} from "./types";
import type { Money, PaymentCategory } from "./types";

export type CreatePaymentIntentInput = {
  idempotencyKey: string;
  category: PaymentCategory;
  buyerUserId: string;
  amount: Money;
  orderId?: string | null;
};

export type RefundPaymentInput = {
  idempotencyKey: string;
  paymentId: string;
  amount: Money;
};

export type CreateSellerAccountInput = {
  sellerUserId: string;
  idempotencyKey: string;
};

export type CreatePayoutInput = {
  sellerUserId: string;
  idempotencyKey: string;
  amount: Money;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  retrievePayment(providerPaymentId: string): Promise<Payment | null>;
  refundPayment(input: RefundPaymentInput): Promise<Refund>;
}

export interface SellerProviderAdapter {
  readonly provider: PaymentProvider;
  createSellerAccount(input: CreateSellerAccountInput): Promise<SellerAccount>;
  createOnboardingLink(seller: SellerAccount): Promise<{ url: string; expiresAt: string }>;
  retrieveSellerAccount(providerAccountId: string): Promise<SellerAccount | null>;
}

export interface PayoutProviderAdapter {
  readonly provider: PaymentProvider;
  createPayout(input: CreatePayoutInput): Promise<Payout>;
  retrievePayout(providerPayoutId: string): Promise<Payout | null>;
}

export interface WebhookEventNormalizer {
  readonly provider: PaymentProvider;
  normalizeEvent(input: unknown): NormalizedExternalEvent;
}

export interface ReconciliationMatcher {
  match(
    event: NormalizedExternalEvent,
    subjects: readonly ReconciliationSubject[],
    seenProviderEventIds?: ReadonlySet<string>,
  ): ReconciliationResult;
}

export type ProviderDispute = Dispute;