import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ServiceZone, GeofenceValidationResult } from '../types';
import { INITIAL_SERVICE_ZONES, calculateBoundingBox } from '../data/serviceZones';

/**
 * Calculates great-circle distance between two points in kilometers using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_KM = 6371; // Mean radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLng = ((lng2 - lng1) * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;
  return Number(distance.toFixed(2));
}

/**
 * Seed initial service zones into Firestore if the collection is empty.
 */
export async function seedServiceZonesIfEmpty(): Promise<ServiceZone[]> {
  try {
    const zonesRef = collection(db, 'service_zones');
    const existingSnap = await getDocs(query(zonesRef, limit(1)));

    if (existingSnap.empty) {
      console.log('Seeding initial service zones into Firestore...');
      for (const zone of INITIAL_SERVICE_ZONES) {
        await setDoc(doc(db, 'service_zones', zone.id), zone);
      }
      return INITIAL_SERVICE_ZONES;
    }

    // Load all zones from Firestore
    const allSnap = await getDocs(zonesRef);
    const zones: ServiceZone[] = [];
    allSnap.forEach(d => {
      zones.push(d.data() as ServiceZone);
    });
    return zones.length > 0 ? zones : INITIAL_SERVICE_ZONES;
  } catch (err) {
    console.warn('Notice loading Firestore service zones, using defaults:', err);
    return INITIAL_SERVICE_ZONES;
  }
}

/**
 * Query active service zones from Firestore.
 * Supports filtering by city or bounding box coordinates.
 */
export async function queryServiceZonesFromFirestore(city?: string): Promise<ServiceZone[]> {
  try {
    const zonesRef = collection(db, 'service_zones');
    let q = query(zonesRef, where('isActive', '==', true));

    if (city) {
      q = query(zonesRef, where('isActive', '==', true), where('city', '==', city));
    }

    const snap = await getDocs(q);
    const zones: ServiceZone[] = [];
    snap.forEach(d => {
      zones.push(d.data() as ServiceZone);
    });

    if (zones.length === 0 && city) {
      // Fallback to all active zones if city specific wasn't found
      const fallbackSnap = await getDocs(query(zonesRef, where('isActive', '==', true)));
      fallbackSnap.forEach(d => {
        zones.push(d.data() as ServiceZone);
      });
    }

    return zones.length > 0 ? zones : INITIAL_SERVICE_ZONES;
  } catch (err) {
    console.warn('Firestore query service_zones fallback:', err);
    return INITIAL_SERVICE_ZONES.filter(z => z.isActive);
  }
}

/**
 * Validates a technician's coordinates against active Firestore service zones.
 * Determines if the technician is within the designated service radius of any operating zone.
 */
export async function validateTechnicianGeofence(
  technicianCoords: { lat: number; lng: number; address?: string },
  preferredCity?: string,
  cachedZones?: ServiceZone[]
): Promise<GeofenceValidationResult> {
  const { lat, lng } = technicianCoords;

  // 1. Fetch zones from Firestore (or use provided cache)
  const zones = cachedZones && cachedZones.length > 0
    ? cachedZones
    : await queryServiceZonesFromFirestore(preferredCity);

  if (!zones || zones.length === 0) {
    return {
      allowed: false,
      insideZone: null,
      distanceKm: 0,
      minDistanceToAllowedZoneKm: 0,
      technicianLocation: technicianCoords,
      reason: 'No active service zones are currently registered in Firestore.'
    };
  }

  // 2. Compute distances and check each zone
  let insideZone: ServiceZone | null = null;
  let nearestZone: ServiceZone = zones[0];
  let minDistance = Infinity;

  for (const zone of zones) {
    const dist = calculateHaversineDistanceKm(lat, lng, zone.center.lat, zone.center.lng);

    if (dist < minDistance) {
      minDistance = dist;
      nearestZone = zone;
    }

    if (dist <= zone.radiusKm) {
      insideZone = zone;
      break; // Found an allowed operating zone
    }
  }

  if (insideZone) {
    const distToZoneCenter = calculateHaversineDistanceKm(
      lat,
      lng,
      insideZone.center.lat,
      insideZone.center.lng
    );

    return {
      allowed: true,
      insideZone,
      distanceKm: distToZoneCenter,
      nearestZone: insideZone,
      minDistanceToAllowedZoneKm: distToZoneCenter,
      technicianLocation: technicianCoords,
      reason: `Verified inside ${insideZone.name} (${distToZoneCenter} km from center, allowed radius: ${insideZone.radiusKm} km).`
    };
  }

  // Outside all active service radius areas
  const excessKm = Number((minDistance - nearestZone.radiusKm).toFixed(2));
  return {
    allowed: false,
    insideZone: null,
    distanceKm: minDistance,
    nearestZone,
    minDistanceToAllowedZoneKm: minDistance,
    technicianLocation: technicianCoords,
    reason: `Geo-fence Out of Bounds: You are ${minDistance} km from ${nearestZone.name} (Operating radius: ${nearestZone.radiusKm} km). You are ${excessKm} km outside the approved service perimeter.`
  };
}

/**
 * Updates a technician's online status and geolocation coordinates in Firestore.
 */
export async function updateTechnicianFirestoreStatus(
  technicianId: string,
  isOnline: boolean,
  locationData?: {
    lat: number;
    lng: number;
    address?: string;
    zoneId?: string;
    zoneName?: string;
    distanceToCenterKm?: number;
  }
) {
  try {
    const techRef = doc(db, 'technicians', technicianId);
    const updatePayload: any = {
      isOnline,
      lastStatusChangeAt: new Date().toISOString()
    };

    if (locationData) {
      updatePayload.currentLocation = {
        ...locationData,
        lastUpdated: new Date().toISOString()
      };
    }

    await updateDoc(techRef, updatePayload);
    return true;
  } catch (err) {
    console.warn('Notice updating technician Firestore status:', err);
    return false;
  }
}
