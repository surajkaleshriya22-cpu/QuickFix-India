import { ServiceZone } from '../types';

/**
 * Calculates a bounding box (minLat, maxLat, minLng, maxLng) for a center coordinate and radius.
 * Useful for Firestore indexed range queries on geolocation fields.
 */
export function calculateBoundingBox(lat: number, lng: number, radiusKm: number) {
  // Approximate conversion: 1 degree latitude ~= 111 km
  const latDelta = radiusKm / 111.0;
  // 1 degree longitude ~= 111 * cos(lat in radians)
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180.0));

  return {
    minLat: Number((lat - latDelta).toFixed(6)),
    maxLat: Number((lat + latDelta).toFixed(6)),
    minLng: Number((lng - lngDelta).toFixed(6)),
    maxLng: Number((lng + lngDelta).toFixed(6)),
  };
}

export const INITIAL_SERVICE_ZONES: ServiceZone[] = [
  {
    id: 'zone-indore-central',
    name: 'Indore Metro Operations Hub',
    city: 'Indore',
    center: { lat: 22.7196, lng: 75.8577 },
    radiusKm: 20,
    ...calculateBoundingBox(22.7196, 75.8577, 20),
    isActive: true,
    description: 'Central operational zone covering Rajwada, Vijay Nagar, Palasia, Silicon City, Rau, and Super Corridor.',
    coverageAreas: ['Vijay Nagar', 'Palasia', 'Rajwada', 'Bhawarkua', 'Silicon City', 'Rau', 'Pithampur Bypass', 'Aerodrome Road'],
    maxActiveTechnicians: 50,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-bhopal-capital',
    name: 'Bhopal Capital Operations Hub',
    city: 'Bhopal',
    center: { lat: 23.2599, lng: 77.4126 },
    radiusKm: 22,
    ...calculateBoundingBox(23.2599, 77.4126, 22),
    isActive: true,
    description: 'Bhopal central and suburban zone covering MP Nagar, Arera Colony, Kolar Road, TT Nagar, and Bairagarh.',
    coverageAreas: ['MP Nagar', 'Arera Colony', 'Kolar Road', 'TT Nagar', 'Bairagarh', 'Hoshangabad Road', 'Ayodhya Bypass'],
    maxActiveTechnicians: 45,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-ujjain-central',
    name: 'Ujjain Mahakal Operational Zone',
    city: 'Ujjain',
    center: { lat: 23.1765, lng: 75.7885 },
    radiusKm: 18,
    ...calculateBoundingBox(23.1765, 75.7885, 18),
    isActive: true,
    description: 'Holy corridor and urban Ujjain covering Freeganj, Nanakheda, Mahakal corridor, and Agar Road.',
    coverageAreas: ['Freeganj', 'Nanakheda', 'Mahakal Corridor', 'Sethji ki Bagichi', 'Agar Road', 'Dewas Gate'],
    maxActiveTechnicians: 30,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-dewas-industrial',
    name: 'Dewas Industrial & City Zone',
    city: 'Dewas',
    center: { lat: 22.9676, lng: 76.0534 },
    radiusKm: 15,
    ...calculateBoundingBox(22.9676, 76.0534, 15),
    isActive: true,
    description: 'Dewas city center and industrial belt covering Vikas Nagar, BNP Press, and AB Road.',
    coverageAreas: ['Vikas Nagar', 'BNP Colony', 'AB Road', 'Kshipra Marg', 'Mata Mandir Area'],
    maxActiveTechnicians: 25,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-bengaluru-tech',
    name: 'Bengaluru Tech Corridor Hub',
    city: 'Bengaluru',
    center: { lat: 12.9716, lng: 77.5946 },
    radiusKm: 25,
    ...calculateBoundingBox(12.9716, 77.5946, 25),
    isActive: true,
    description: 'High-density tech zone covering Koramangala, Indiranagar, HSR Layout, Whitefield, Electronic City, and Bellandur.',
    coverageAreas: ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Electronic City', 'Bellandur', 'Marathahalli', 'Jayanagar'],
    maxActiveTechnicians: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-mumbai-suburban',
    name: 'Mumbai Suburban & Island Hub',
    city: 'Mumbai',
    center: { lat: 19.0760, lng: 72.8777 },
    radiusKm: 25,
    ...calculateBoundingBox(19.0760, 72.8777, 25),
    isActive: true,
    description: 'Greater Mumbai zone covering Bandra, Andheri, Powai, Dadar, Chembur, and Borivali.',
    coverageAreas: ['Bandra West', 'Andheri East/West', 'Powai', 'Dadar', 'Chembur', 'Goregaon', 'Borivali'],
    maxActiveTechnicians: 90,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-pune-metropolitan',
    name: 'Pune IT & Metropolitan Hub',
    city: 'Pune',
    center: { lat: 18.5204, lng: 73.8567 },
    radiusKm: 22,
    ...calculateBoundingBox(18.5204, 73.8567, 22),
    isActive: true,
    description: 'Pune metropolitan zone covering Shivaji Nagar, Kothrud, Hinjewadi IT Park, Viman Nagar, and Baner.',
    coverageAreas: ['Hinjewadi', 'Kothrud', 'Shivaji Nagar', 'Viman Nagar', 'Baner', 'Wakad', 'Hadapsar'],
    maxActiveTechnicians: 60,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'zone-delhi-ncr',
    name: 'Delhi NCR Capital Zone',
    city: 'Delhi-NCR',
    center: { lat: 28.6139, lng: 77.2090 },
    radiusKm: 28,
    ...calculateBoundingBox(28.6139, 77.2090, 28),
    isActive: true,
    description: 'National Capital Region covering South Delhi, Central Delhi, Noida Sector 18, and Gurugram DLF/CyberHub.',
    coverageAreas: ['Connaught Place', 'South Extension', 'Dwarka', 'Noida Sec 18', 'Gurugram CyberHub', 'Saket', 'Lajpat Nagar'],
    maxActiveTechnicians: 100,
    createdAt: '2026-01-01T00:00:00Z',
  },
];
