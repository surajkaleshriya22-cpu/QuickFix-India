export type PartnerDispatchProfile = {
  role?: unknown;
  approvalStatus?: unknown;
  isVerified?: unknown;
  isOnline?: unknown;
  isSuspended?: unknown;
  securityDepositPaid?: unknown;
  walletBalance?: unknown;
};

/** Fail-closed dispatch eligibility shared by partner job-feed and acceptance APIs. */
export function isPartnerEligibleForDispatch(profile: PartnerDispatchProfile): boolean {
  return (profile.role === 'CHANNEL_PARTNER' || profile.role === 'TECHNICIAN') &&
    profile.approvalStatus === 'approved' &&
    profile.isVerified === true &&
    profile.isOnline === true &&
    profile.isSuspended !== true &&
    profile.securityDepositPaid === true &&
    typeof profile.walletBalance === 'number' &&
    Number.isFinite(profile.walletBalance) &&
    profile.walletBalance >= 2000;
}
