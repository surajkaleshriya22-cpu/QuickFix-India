export type GeoPoint = { latitude: number; longitude: number };

const MAX_PARTNER_DISTANCE_KM = 15;

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
 * Hard maximum customer-to-partner dispatch distance is 15 km.
 * A partner may configure a smaller radius, but never a larger one.
 * Missing/invalid partner or customer GPS coordinates fail closed; area-only
 * matching is not sufficient to guarantee the 15 km safety limit.
 */
export function isWithinPartnerDispatchRadius(
  partner: Record<string, unknown>,
  booking: Record<string, unknown>
): boolean {
  if (!isGeoPoint(partner.dispatchLocation) || !isGeoPoint(booking.customerLocation)) return false;

  const configuredRadius = partner.dispatchRadiusKm;
  if (configuredRadius !== undefined && configuredRadius !== null &&
      (typeof configuredRadius !== 'number' || !Number.isFinite(configuredRadius) || configuredRadius < 1)) {
    return false;
  }

  const effectiveRadius = Math.min(
    typeof configuredRadius === 'number' ? configuredRadius : MAX_PARTNER_DISTANCE_KM,
    MAX_PARTNER_DISTANCE_KM
  );
  return distanceBetweenPointsKm(partner.dispatchLocation, booking.customerLocation) <= effectiveRadius;
}
