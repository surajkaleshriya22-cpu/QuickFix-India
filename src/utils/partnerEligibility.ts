export type PartnerDispatchProfile = {
  role?: unknown;
  approvalStatus?: unknown;
  isVerified?: unknown;
  isOnline?: unknown;
  isSuspended?: unknown;
  securityDepositPaid?: unknown;
  walletBalance?: unknown;
};

/** Fail-closed requirements for activating a partner's online duty. */
export function canActivatePartnerDuty(profile: PartnerDispatchProfile): boolean {
  return (profile.role === 'CHANNEL_PARTNER' || profile.role === 'TECHNICIAN') &&
    profile.approvalStatus === 'approved' &&
    profile.isVerified === true &&
    profile.isSuspended !== true &&
    profile.securityDepositPaid === true &&
    typeof profile.walletBalance === 'number' &&
    Number.isFinite(profile.walletBalance) &&
    profile.walletBalance >= 2000;
}

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

const DISPATCHABLE_PARTNER_TRADES = new Set([
  'electrician', 'plumber', 'ac_repair', 'fridge_repair', 'appliance_repair', 'welder', 'mechanic',
  'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'kaamkaaj_partner',
  'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting'
]);

/** Convert registered partner trades into the service categories they can receive. */
export function getPartnerServiceCategories(trades: unknown): Set<string> {
  const categories = new Set<string>();
  if (!Array.isArray(trades)) return categories;

  for (const trade of trades) {
    if (trade === 'technician' || trade === 'ac_fridge') {
      categories.add('ac_repair');
      categories.add('fridge_repair');
      categories.add('appliance_repair');
    } else if (trade === 'bike_rider') {
      categories.add('bike_taxi');
    } else if (typeof trade === 'string' && ['house_cleaning', 'cook', 'laundry', 'maid'].includes(trade)) {
      categories.add('kaamkaaj_partner');
    } else if (typeof trade === 'string' && DISPATCHABLE_PARTNER_TRADES.has(trade)) {
      categories.add(trade);
    }
  }
  return categories;
}


/** A partner can receive a booking only when its exact service category is covered by their registered trades. */
export function canPartnerReceiveBookingCategory(trades: unknown, bookingCategory: unknown): boolean {
  if (typeof bookingCategory !== 'string' || !bookingCategory.trim()) return false;
  return getPartnerServiceCategories(trades).has(bookingCategory.trim());
}
