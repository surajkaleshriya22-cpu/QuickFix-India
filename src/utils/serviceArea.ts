export type AdministrativeServiceArea = { state?: unknown; district?: unknown; tehsil?: unknown };

export function normalizeServiceAreaValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
}

export function serviceAreaKey(value: unknown): string {
  return normalizeServiceAreaValue(value).normalize('NFKC');
}

export function hasDistrictServiceArea(area: unknown): area is AdministrativeServiceArea {
  if (!area || typeof area !== 'object' || Array.isArray(area)) return false;
  const value = area as AdministrativeServiceArea;
  return Boolean(normalizeServiceAreaValue(value.state) && normalizeServiceAreaValue(value.district));
}

/** District-scoped matching with exact-city fallback for legacy records. GPS radius remains mandatory separately. */
export function matchesPartnerServiceArea(partnerArea: unknown, bookingArea: unknown, partnerCity: unknown, bookingCity: unknown): boolean {
  if (hasDistrictServiceArea(partnerArea) && hasDistrictServiceArea(bookingArea)) {
    return normalizeServiceAreaValue(partnerArea.state) === normalizeServiceAreaValue(bookingArea.state) &&
      normalizeServiceAreaValue(partnerArea.district) === normalizeServiceAreaValue(bookingArea.district);
  }
  const partnerCityValue = normalizeServiceAreaValue(partnerCity);
  const bookingCityValue = normalizeServiceAreaValue(bookingCity);
  return Boolean(partnerCityValue && bookingCityValue && partnerCityValue === bookingCityValue);
}
