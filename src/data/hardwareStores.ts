// Do not keep unverified shop names, phone numbers, addresses, ratings or opening hours.
// The directory now uses Google Maps category searches so users can verify current listings.
export type HardwareCategory = 'all' | 'electrical' | 'plumbing' | 'ac';

export const HARDWARE_CATEGORY_LABELS: Record<HardwareCategory, string> = {
  all: 'hardware and spare-parts shops',
  electrical: 'electrical supply shops',
  plumbing: 'plumbing and sanitary shops',
  ac: 'AC and refrigerator spare-parts shops',
};

export function getHardwareMapsSearchUrl(city: string, category: HardwareCategory): string {
  const safeCity = city.trim() || 'India';
  const query = HARDWARE_CATEGORY_LABELS[category];
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(query + ' near ' + safeCity);
}
