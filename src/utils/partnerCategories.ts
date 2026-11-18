export type PartnerServiceArea = Record<string, unknown> | null | undefined;

const VALID_PARTNER_CATEGORIES = new Set([
  'electrician',
  'plumber',
  'technician',
  'welder',
  'mechanic',
  'driver',
  'tourist_guide',
  'contractor',
  'bike_rider',
  'labour'
]);

/** Convert partner trades and legacy AC/fridge trades to the canonical service categories. */
export function getPartnerDispatchCategories(trades: unknown[]): Set<string> {
  const categories = new Set<string>();
  for (const rawTrade of trades) {
    if (typeof rawTrade !== 'string') continue;
    const trade = rawTrade.trim().toLocaleLowerCase('en-IN');
    const category = ['ac_fridge', 'ac_repair', 'fridge_repair'].includes(trade)
      ? 'technician'
      : trade;
    if (VALID_PARTNER_CATEGORIES.has(category)) categories.add(category);
  }
  return categories;
}

function normalizeAreaValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
}

function hasCompleteServiceArea(area: PartnerServiceArea): area is Record<string, unknown> {
  return Boolean(area && ['state', 'district', 'tehsil'].every((key) => normalizeAreaValue(area[key])));
}

/** Shared feed/acceptance scope check; city and category are always required. */
export function isBookingWithinPartnerScope(input: {
  partnerCity: unknown;
  bookingCity: unknown;
  partnerCategories: Set<string>;
  bookingCategory: unknown;
  partnerArea?: PartnerServiceArea;
  bookingArea?: PartnerServiceArea;
}): boolean {
  const partnerCity = normalizeAreaValue(input.partnerCity);
  const bookingCity = normalizeAreaValue(input.bookingCity);
  const bookingCategory = typeof input.bookingCategory === 'string'
    ? input.bookingCategory.trim().toLocaleLowerCase('en-IN')
    : '';
  const canonicalBookingCategory = ['ac_fridge', 'ac_repair', 'fridge_repair'].includes(bookingCategory)
    ? 'technician'
    : bookingCategory;

  if (!partnerCity || partnerCity.length < 2 || partnerCity !== bookingCity ||
      !input.partnerCategories.has(canonicalBookingCategory)) {
    return false;
  }

  // Legacy records may not have full state/district/tehsil data. When both
  // sides provide it, require an exact normalized match on all three fields.
  if (hasCompleteServiceArea(input.partnerArea) && hasCompleteServiceArea(input.bookingArea)) {
    return ['state', 'district', 'tehsil'].every((key) =>
      normalizeAreaValue(input.partnerArea![key]) === normalizeAreaValue(input.bookingArea![key])
    );
  }
  return true;
}
