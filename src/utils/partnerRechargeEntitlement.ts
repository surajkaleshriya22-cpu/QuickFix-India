export type RechargeEntitlementProfile = { createdAt?: unknown };
export type RechargeEntitlementPolicy = { paymentEnabled?: unknown; dutyGatingEnabled?: unknown; freeTrialDays?: unknown };
export type RechargeEntitlementAccount = { activeUntil?: unknown };

function timestampMs(value: unknown): number | null {
  try {
    const date = value instanceof Date ? value :
      value && typeof (value as { toDate?: unknown }).toDate === 'function'
        ? (value as { toDate: () => Date }).toDate()
        : null;
    const ms = date instanceof Date ? date.getTime() : NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/**
 * Server-only partner duty entitlement. The gate remains off until checkout,
 * verified payment credit, refunds and reconciliation are production-ready.
 * Once enabled, a valid free trial OR an unexpired server-ledger recharge is
 * required. Missing or malformed dates fail closed while the gate is active.
 */
export function isPartnerRechargeEntitled(
  profile: RechargeEntitlementProfile | undefined,
  policy: RechargeEntitlementPolicy | undefined,
  account: RechargeEntitlementAccount | undefined,
  nowMs = Date.now()
): boolean {
  if (policy?.paymentEnabled !== true || policy?.dutyGatingEnabled !== true) return true;
  if (!profile || !policy || !Number.isFinite(nowMs)) return false;
  const freeTrialDays = Number(policy.freeTrialDays);
  if (!Number.isInteger(freeTrialDays) || freeTrialDays < 0 || freeTrialDays > 365) return false;
  const trialStartMs = timestampMs(profile.createdAt);
  const paidUntilMs = timestampMs(account?.activeUntil);
  const trialActive = trialStartMs !== null && nowMs < trialStartMs + freeTrialDays * 86400000;
  const paidRechargeActive = paidUntilMs !== null && paidUntilMs > nowMs;
  return trialActive || paidRechargeActive;
}
