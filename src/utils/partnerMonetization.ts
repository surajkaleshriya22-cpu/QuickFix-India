/**
 * QuickFix partner monetization policy.
 * Partner revenue comes from subscriptions, never per-booking commission.
 */
export function calculatePartnerBookingCommission(_servicePrice: number): number {
  return 0;
}

/**
 * The partner's service earning is the listed service price.
 * Customer convenience charges, discounts, and taxes are handled separately
 * and must never be treated as partner commission.
 */
export function calculatePartnerServiceEarning(servicePrice: number): number {
  if (!Number.isFinite(servicePrice) || servicePrice < 0) return 0;
  return servicePrice;
}
