export type PartnerDispatchProfile = {
  role?: unknown;
  roles?: unknown;
  approvalStatus?: unknown;
  isVerified?: unknown;
  isOnline?: unknown;
  isSuspended?: unknown;
  /** @deprecated Legacy reserve fields are ignored; they never gate duty. */
  securityDepositPaid?: unknown;
  walletBalance?: unknown;
  subscriptionStatus?: unknown;
  subscriptionExpiresAt?: unknown;
};

/** Fail-closed requirements for activating a partner's online duty. */
export function canActivatePartnerDuty(profile: PartnerDispatchProfile): boolean {
  const expiryValue = profile.subscriptionExpiresAt as { toMillis?: () => number } | Date | number | string | null | undefined;
  const expiryMs = expiryValue && typeof expiryValue === 'object' && 'toMillis' in expiryValue && typeof expiryValue.toMillis === 'function'
    ? expiryValue.toMillis()
    : expiryValue instanceof Date ? expiryValue.getTime()
      : typeof expiryValue === 'number' ? expiryValue
        : typeof expiryValue === 'string' ? Date.parse(expiryValue) : null;
  const subscriptionValid = profile.subscriptionStatus !== 'expired' &&
    (expiryMs === null || (Number.isFinite(expiryMs) && expiryMs > Date.now()));
  return subscriptionValid &&
    ((Array.isArray(profile.roles) ? profile.roles : [profile.role]).some((role) => role === 'CHANNEL_PARTNER' || role === 'TECHNICIAN')) &&
    profile.approvalStatus === 'approved' &&
    profile.isVerified === true &&
    profile.isSuspended !== true;
}

/** Fail-closed dispatch eligibility shared by partner job-feed and acceptance APIs. */
export function isPartnerEligibleForDispatch(profile: PartnerDispatchProfile): boolean {
  // Existing partner records without subscription fields remain compatible until migrated.
  // New registrations always receive an expiry; an explicit expired state blocks dispatch.
  const expiryValue = profile.subscriptionExpiresAt as { toMillis?: () => number } | Date | number | string | null | undefined;
  const expiryMs = expiryValue && typeof expiryValue === 'object' && 'toMillis' in expiryValue && typeof expiryValue.toMillis === 'function'
    ? expiryValue.toMillis()
    : expiryValue instanceof Date ? expiryValue.getTime()
      : typeof expiryValue === 'number' ? expiryValue
        : typeof expiryValue === 'string' ? Date.parse(expiryValue) : null;
  const subscriptionValid = profile.subscriptionStatus !== 'expired' &&
    (expiryMs === null || (Number.isFinite(expiryMs) && expiryMs > Date.now()));
  return subscriptionValid && ((Array.isArray(profile.roles) ? profile.roles : [profile.role]).some((role) => role === 'CHANNEL_PARTNER' || role === 'TECHNICIAN')) &&
    profile.approvalStatus === 'approved' &&
    profile.isVerified === true &&
    profile.isOnline === true &&
    profile.isSuspended !== true;
}

const DISPATCHABLE_PARTNER_TRADES = new Set([
  'electrician', 'plumber', 'ac_repair', 'fridge_repair', 'appliance_repair', 'welder', 'mechanic',
  'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'kaamkaaj_partner',
  'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting', 'car_wash', 'transport'
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


/** A multi-service booking is dispatchable only to a partner qualified for every line item. */
export function canPartnerReceiveBookingCategories(trades: unknown, bookingCategories: unknown): boolean {
  if (!Array.isArray(bookingCategories) || bookingCategories.length === 0) return false;
  const required = [...new Set(bookingCategories)];
  if (required.some(category => typeof category !== 'string' || !category.trim())) return false;
  const supported = getPartnerServiceCategories(trades);
  return required.every(category => supported.has((category as string).trim()));
}
