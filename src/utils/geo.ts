export type GeoPoint = { latitude: number; longitude: number };

function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === 'number' && Number.isFinite(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180;
}

/** Great-circle distance between two WGS84 points, in kilometres. */
export function distanceBetweenPointsKm(a: GeoPoint, b: GeoPoint): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371.0088;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/**
 * Enforce a partner's configured dispatch geofence.
 * Legacy profiles without any geofence configuration retain the existing
 * state/district/tehsil matching. Once a radius is configured, malformed or
 * missing coordinates fail closed instead of silently bypassing the fence.
 */
export function isWithinPartnerDispatchRadius(
  partner: Record<string, unknown>,
  booking: Record<string, unknown>
): boolean {
  const radiusConfigured = partner.dispatchRadiusKm !== undefined && partner.dispatchRadiusKm !== null;
  const locationConfigured = partner.dispatchLocation !== undefined && partner.dispatchLocation !== null;
  if (!radiusConfigured && !locationConfigured) return true;

  const radius = partner.dispatchRadiusKm;
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 1 || radius > 100) return false;
  if (!isGeoPoint(partner.dispatchLocation) || !isGeoPoint(booking.customerLocation)) return false;
  return distanceBetweenPointsKm(partner.dispatchLocation, booking.customerLocation) <= radius;
}
