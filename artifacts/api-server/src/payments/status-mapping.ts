import type { DisputeStatus, PayoutStatus, SellerStatus } from "./types";

export type ProviderSellerState = {
  accountExists: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: boolean;
  disabled: boolean;
};

export function mapSellerStatus(state: ProviderSellerState): SellerStatus {
  if (!state.accountExists) return "not_onboarded";
  if (state.disabled) return "disabled";
  if (state.requirementsDue) return "restricted";
  if (!state.detailsSubmitted) return "onboarding_required";
  if (!state.chargesEnabled || !state.payoutsEnabled) return "pending";
  return "active";
}

export function canReceivePaidSales(status: SellerStatus): boolean {
  return status === "active";
}

export function mapPayoutStatus(input: {
  paid: boolean;
  inTransit: boolean;
  failed: boolean;
  reversed: boolean;
}): PayoutStatus {
  if (input.reversed) return "reversed";
  if (input.failed) return "failed";
  if (input.paid) return "paid";
  if (input.inTransit) return "in_transit";
  return "pending";
}

export function mapDisputeStatus(input: {
  opened: boolean;
  won: boolean;
  lost: boolean;
  reversed: boolean;
}): DisputeStatus {
  if (input.reversed) return "reversed";
  if (input.lost) return "lost";
  if (input.won) return "won";
  if (input.opened) return "opened";
  return "opened";
}