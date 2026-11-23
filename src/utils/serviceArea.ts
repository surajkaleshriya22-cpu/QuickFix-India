export type AdministrativeServiceArea = {
  state?: unknown;
  district?: unknown;
  tehsil?: unknown;
};

export function normalizeServiceAreaValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
}

/** Stable Firestore equality key for state/district queries. */
export function serviceAreaKey(value: unknown): string {
  return normalizeServiceAreaValue(value).normalize('NFKC');
}

export function hasDistrictServiceArea(area: unknown): area is AdministrativeServiceArea {
  if (!area || typeof area !== 'object' || Array.isArray(area)) return false;
  const value = area as AdministrativeServiceArea;
  return Boolean(normalizeServiceAreaValue(value.state) && normalizeServiceAreaValue(value.district));
}

/**
 * Service areas are district-scoped, not city-name-scoped. GPS dispatch radius
 * remains a separate mandatory check, so matching a district never bypasses
 * the partner's configured distance limit. Legacy profiles/bookings without
 * structured areas retain exact-city matching.
 */
export function matchesPartnerServiceArea(
  partnerArea: unknown,
  bookingArea: unknown,
  partnerCity: unknown,
  bookingCity: unknown
): boolean {
  if (hasDistrictServiceArea(partnerArea) && hasDistrictServiceArea(bookingArea)) {
    return normalizeServiceAreaValue(partnerArea.state) === normalizeServiceAreaValue(bookingArea.state) &&
      normalizeServiceAreaValue(partnerArea.district) === normalizeServiceAreaValue(bookingArea.district);
  }

  const partnerCityValue = normalizeServiceAreaValue(partnerCity);
  const bookingCityValue = normalizeServiceAreaValue(bookingCity);
  return Boolean(partnerCityValue && bookingCityValue && partnerCityValue === bookingCityValue);
}
