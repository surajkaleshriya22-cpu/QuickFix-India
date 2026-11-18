import type { BillingUnit } from './pricing';

export type RateApprovalStatus = 'draft' | 'approved' | 'retired';
export type RateLocationLevel = 'tehsil' | 'city' | 'district' | 'state';

export interface LocationRateCard {
  id: string;
  state: string;
  district: string;
  city?: string;
  tehsil?: string;
  serviceCategory: string;
  serviceId?: string;
  unit: BillingUnit;
  currency: 'INR';
  minimumRate: number;
  maximumRate: number;
  minimumCharge: number;
  baseFee?: number;
  materialsIncluded: boolean;
  approvalStatus: RateApprovalStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceName: string;
  sourceUrl?: string;
  sourceCheckedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes: string;
}

export interface RateLookupLocation {
  state: string;
  district: string;
  city?: string;
  tehsil?: string;
}

export interface RateQuote {
  unit: BillingUnit;
  quantity: number;
  rateMinimum: number;
  rateMaximum: number;
  subtotalMinimum: number;
  subtotalMaximum: number;
  baseFee: number;
  minimumCharge: number;
  totalMinimum: number;
  totalMaximum: number;
  materialsIncluded: boolean;
}

/**
 * Resolve only published/approved rates. More specific locality wins:
 * tehsil > city > district > state. No silent fallback to mockData startingPrice.
 */
export function resolveLocationRateCard(
  cards: LocationRateCard[],
  location: RateLookupLocation,
  serviceCategory: string,
  serviceId: string,
  unit: BillingUnit,
  onDate: string
): LocationRateCard | null {
  const norm = (value?: string) => (value || '').trim().toLocaleLowerCase('en-IN');
  const candidates = cards.filter(card =>
    card.approvalStatus === 'approved' &&
    norm(card.state) === norm(location.state) &&
    norm(card.district) === norm(location.district) &&
    (!card.city || norm(card.city) === norm(location.city)) &&
    (!card.tehsil || norm(card.tehsil) === norm(location.tehsil)) &&
    card.serviceCategory === serviceCategory &&
    (!card.serviceId || card.serviceId === serviceId) &&
    card.unit === unit &&
    card.effectiveFrom <= onDate &&
    (!card.effectiveTo || card.effectiveTo >= onDate)
  );
  const specificity = (card: LocationRateCard) =>
    (card.tehsil ? 4 : 0) + (card.city ? 2 : 0) + (card.serviceId ? 1 : 0);
  candidates.sort((a, b) => specificity(b) - specificity(a) || b.effectiveFrom.localeCompare(a.effectiveFrom));
  return candidates[0] || null;
}

export function calculateRateQuote(
  card: Pick<LocationRateCard, 'unit' | 'minimumRate' | 'maximumRate' | 'minimumCharge' | 'baseFee' | 'materialsIncluded'>,
  quantity: number
): RateQuote {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive number.');
  }
  for (const amount of [card.minimumRate, card.maximumRate, card.minimumCharge, card.baseFee || 0]) {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Rate card contains an invalid amount.');
  }
  if (card.maximumRate < card.minimumRate) throw new Error('Maximum rate cannot be lower than minimum rate.');
  const baseFee = card.baseFee || 0;
  const subtotalMinimum = quantity * card.minimumRate + baseFee;
  const subtotalMaximum = quantity * card.maximumRate + baseFee;
  return {
    unit: card.unit,
    quantity,
    rateMinimum: card.minimumRate,
    rateMaximum: card.maximumRate,
    subtotalMinimum,
    subtotalMaximum,
    baseFee,
    minimumCharge: card.minimumCharge,
    totalMinimum: Math.max(subtotalMinimum, card.minimumCharge),
    totalMaximum: Math.max(subtotalMaximum, card.minimumCharge),
    materialsIncluded: card.materialsIncluded
  };
}

/** MP statutory wage floor reference, not a customer-facing service tariff. */
export const MP_STATUTORY_DAILY_WAGE_FLOOR = {
  jurisdiction: 'Madhya Pradesh',
  effectiveFrom: '2026-10-01',
  effectiveTo: '2027-03-31',
  currency: 'INR',
  daily: {
    unskilled: 484,
    semiSkilled: 522,
    skilled: 588,
    highlySkilled: 651
  },
  sourceName: 'Madhya Pradesh Labour Commissioner notification 30 September 2026, Order 22284',
  sourceUrl: 'https://nkonehrsolutions.com/notifications/minimum-wages/madhya-pradesh-2026-10.pdf',
  notes: 'Applies only to covered scheduled employments. Confirm the applicable employment schedule and legal coverage. This is a statutory wage floor reference, not a retail customer service price.'
} as const;
