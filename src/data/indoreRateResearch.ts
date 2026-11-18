/**
 * Research-only Indore market benchmarks gathered 18 Nov 2026.
 * These are NOT approved QuickFix tariffs and must never be shown as live prices.
 * Rau/tehsil-level vendor quotations and partner payout/commission validation are still required.
 */
export type BenchmarkUnit = 'per_visit' | 'per_day' | 'per_sqft' | 'per_ac' | 'per_repair' | 'per_2bhk';

export interface MarketRateBenchmark {
  id: string;
  category: string;
  service: string;
  unit: BenchmarkUnit;
  minimumInr: number;
  maximumInr: number;
  priceBasis: 'customer_indicative' | 'labour_only';
  geography: string;
  sourceName: string;
  sourceUrl: string;
  checkedOn: '2026-11-18';
  confidence: 'low' | 'medium';
  caveat: string;
}

export const INDORE_MARKET_BENCHMARKS: MarketRateBenchmark[] = [
  {
    id: 'indore-electrician-visit-loknex',
    category: 'electrician',
    service: 'Visit / inspection',
    unit: 'per_visit',
    minimumInr: 200,
    maximumInr: 600,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; Rau is named as a service locality, but no Rau-only quote is published',
    sourceName: 'Loknex – Electrician in Indore (Nov 2026)',
    sourceUrl: 'https://loknex.com/electrician-in-indore/',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Published general-market estimate, not a provider quote; parts/fittings extra and final scope must be agreed.'
  },
  {
    id: 'indore-plumber-visit-loknex',
    category: 'plumber',
    service: 'Visit / inspection',
    unit: 'per_visit',
    minimumInr: 200,
    maximumInr: 600,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; Rau is named as a service locality, but no Rau-only quote is published',
    sourceName: 'Loknex – Plumber in Indore (Nov 2026)',
    sourceUrl: 'https://loknex.com/plumber-in-indore/',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Published general-market estimate, not a provider quote; fittings and parts extra.'
  },
  {
    id: 'indore-electrician-daily-labour',
    category: 'electrician',
    service: 'Skilled electrician daily labour',
    unit: 'per_day',
    minimumInr: 686,
    maximumInr: 921,
    priceBasis: 'labour_only',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Research estimate, not a statutory wage notification or retail visit charge; confirm shift duration and task scope.'
  },
  {
    id: 'indore-plumber-daily-labour',
    category: 'plumber',
    service: 'Skilled plumber daily labour',
    unit: 'per_day',
    minimumInr: 686,
    maximumInr: 921,
    priceBasis: 'labour_only',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Research estimate, not a statutory wage notification or retail visit charge; fittings and travel excluded unless agreed.'
  },
  {
    id: 'indore-painter-labour-sqft',
    category: 'painter',
    service: 'Painting labour (putty, primer, two coats)',
    unit: 'per_sqft',
    minimumInr: 6,
    maximumInr: 11,
    priceBasis: 'labour_only',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Labour-only estimate; area measurement, surface preparation and paint/material cost must be itemised.'
  },
  {
    id: 'indore-ac-jet-clean',
    category: 'ac_repair',
    service: 'Split AC foam / power jet service',
    unit: 'per_ac',
    minimumInr: 405,
    maximumInr: 810,
    priceBasis: 'customer_indicative',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Adjusted estimate; AC type, tonnage, indoor/outdoor scope and chemicals must be confirmed.'
  },
  {
    id: 'indore-ac-gas-refill',
    category: 'ac_repair',
    service: '1.5 ton R32 gas refill with leak check',
    unit: 'per_ac',
    minimumInr: 2250,
    maximumInr: 3150,
    priceBasis: 'customer_indicative',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Adjusted estimate; refrigerant type/weight, leak repair, vacuuming and parts must be itemised.'
  },
  {
    id: 'indore-fridge-common-repair',
    category: 'technician',
    service: 'Fridge non-gas common repair',
    unit: 'per_repair',
    minimumInr: 360,
    maximumInr: 1350,
    priceBasis: 'customer_indicative',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Adjusted estimate; diagnosis, model, compressor/PCB parts and warranty scope affect final quote.'
  },
  {
    id: 'indore-deep-clean-2bhk',
    category: 'kaamkaaj_partner',
    service: 'Full home deep cleaning, 2 BHK',
    unit: 'per_2bhk',
    minimumInr: 2700,
    maximumInr: 5400,
    priceBasis: 'customer_indicative',
    geography: 'Indore city estimate',
    sourceName: 'GenuineRate – Construction Rates in Indore 2026',
    sourceUrl: 'https://genuinerate.com/rates/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Adjusted estimate; confirm bathrooms, kitchen, balcony, home condition, team size and chemicals/materials.'
  }
];

/** No benchmark here is eligible for customer display or payout calculation. */
export const INDORE_BENCHMARKS_ARE_PUBLISHABLE = false;
