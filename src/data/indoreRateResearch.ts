/**
 * Research-only Indore market benchmarks gathered 18 Nov 2026.
 * These are NOT approved QuickFix tariffs and must never be shown as live prices.
 * Scope is Indore city-wide, not Rau-only. Published web prices are low-confidence asking-price references,
 * not independently verified quotes. Neighborhood-level dispersion and partner quotations remain required.
 */
export type BenchmarkUnit = 'per_visit' | 'per_hour' | 'per_day' | 'per_sqft' | 'per_ac' | 'per_repair' | 'per_2bhk';

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
  },
  {
    id: 'indore-electrician-hourly-biddaro',
    category: 'electrician',
    service: 'Electrical work labour (hourly)',
    unit: 'per_hour',
    minimumInr: 350,
    maximumInr: 1000,
    priceBasis: 'customer_indicative',
    geography: 'Indore city',
    sourceName: 'Biddaro – Electrical Work Cost in Indore 2026',
    sourceUrl: 'https://www.biddaro.com/cost/electrical/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Indicative platform estimate, not a confirmed transaction; complexity, emergency timing and parts change price.'
  },
  {
    id: 'indore-electrical-point-biddaro',
    category: 'electrician',
    service: 'Power point installation',
    unit: 'per_visit',
    minimumInr: 400,
    maximumInr: 1200,
    priceBasis: 'customer_indicative',
    geography: 'Indore city',
    sourceName: 'Biddaro – Electrical Work Cost in Indore 2026',
    sourceUrl: 'https://www.biddaro.com/cost/electrical/indore',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Per-point estimate; wiring length, wall cutting, switchgear and materials may be extra.'
  },
  {
    id: 'indore-ac-general-clean-cleanhub',
    category: 'ac_repair',
    service: 'AC general service (split/window)',
    unit: 'per_ac',
    minimumInr: 399,
    maximumInr: 399,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; provider advertises multiple city localities',
    sourceName: 'Clean Hub Indore – published service menu',
    sourceUrl: 'https://cleanhub4u.in/indore.html',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Advertised starting/list price, not a verified booking; inclusions and parts need confirmation.'
  },
  {
    id: 'indore-ac-gas-cleanhub',
    category: 'ac_repair',
    service: 'AC gas filling (up to 1.5 ton)',
    unit: 'per_ac',
    minimumInr: 1299,
    maximumInr: 1299,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; provider advertises multiple city localities',
    sourceName: 'Clean Hub Indore – published service menu',
    sourceUrl: 'https://cleanhub4u.in/indore.html',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Advertised list price; refrigerant type/weight, leak repair and warranty scope must be confirmed.'
  },
  {
    id: 'indore-deep-clean-2bhk-cleanhub',
    category: 'kaamkaaj_partner',
    service: '2 BHK home deep cleaning package',
    unit: 'per_2bhk',
    minimumInr: 1099,
    maximumInr: 1099,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; provider advertises multiple city localities',
    sourceName: 'Clean Hub Indore – published service menu',
    sourceUrl: 'https://cleanhub4u.in/indore.html',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Advertised package price differs substantially from other providers; verify scope, team size, add-ons and booking terms.'
  },
  {
    id: 'indore-plumbing-visit-urbixa',
    category: 'plumber',
    service: 'Plumbing visit / basic job starting price',
    unit: 'per_visit',
    minimumInr: 199,
    maximumInr: 199,
    priceBasis: 'customer_indicative',
    geography: 'Indore city',
    sourceName: 'Urbixa – Home Services in Indore',
    sourceUrl: 'https://urbixa.in/',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Advertised visit starting price; actual repair labour, fittings and parts may be additional.'
  },
  {
    id: 'indore-electrician-visit-urbixa',
    category: 'electrician',
    service: 'Electrical visit / basic job starting price',
    unit: 'per_visit',
    minimumInr: 199,
    maximumInr: 199,
    priceBasis: 'customer_indicative',
    geography: 'Indore city',
    sourceName: 'Urbixa – Home Services in Indore',
    sourceUrl: 'https://urbixa.in/',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Advertised starting price, not a universal visit fee or confirmed transaction.'
  },
  {
    id: 'indore-deep-clean-2bhk-urbanhibe',
    category: 'kaamkaaj_partner',
    service: '2 BHK full flat cleaning package',
    unit: 'per_2bhk',
    minimumInr: 5999,
    maximumInr: 5999,
    priceBasis: 'customer_indicative',
    geography: 'Indore city; provider lists Vijay Nagar, Palasia, Bhawarkua and other localities',
    sourceName: 'UrbanHibe – Indore cleaning rates',
    sourceUrl: 'https://urbanhibe.in/',
    checkedOn: '2026-11-18',
    confidence: 'low',
    caveat: 'Different provider/package scope from lower-priced offers; do not compare without matching checklist and inclusions.'
  }
];

/** No benchmark here is eligible for customer display or payout calculation. */
export const INDORE_BENCHMARKS_ARE_PUBLISHABLE = false;
