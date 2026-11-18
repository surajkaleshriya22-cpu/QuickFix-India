/**
 * Indore locality coverage used to organize city-wide market research.
 * This is NOT a QuickFix service-availability map and does NOT assign locality-specific prices.
 * A locality price can only be promoted after comparable local provider quotes are collected and approved.
 */
export type IndoreMarketEvidence = 'citywide_public_estimates_only' | 'multi_locality_provider_listing';

export interface IndoreMarketArea {
  id: string;
  locality: string;
  cluster: string;
  evidence: IndoreMarketEvidence;
  sourceUrls: string[];
  localitySpecificQuotesVerified: false;
}

export const INDORE_MARKET_AREAS: IndoreMarketArea[] = [
  { id: 'vijay-nagar', locality: 'Vijay Nagar', cluster: 'East / commercial', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore', 'https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'palasia', locality: 'Palasia (Old and New)', cluster: 'Central', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore', 'https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'bhawarkua', locality: 'Bhawarkua / Bhanwarkuan', cluster: 'South / central-west', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore', 'https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'rau', locality: 'Rau', cluster: 'West / outer', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore', 'https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'scheme-78', locality: 'Scheme 78', cluster: 'East', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'scheme-54', locality: 'Scheme 54 / PU4', cluster: 'East / commercial', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://loknex.com/electrician-in-indore/', 'https://www.plumberindore.in/'], localitySpecificQuotesVerified: false },
  { id: 'saket', locality: 'Saket', cluster: 'South-central', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'annapurna', locality: 'Annapurna', cluster: 'West', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://loknex.com/electrician-in-indore/'], localitySpecificQuotesVerified: false },
  { id: 'sudama-nagar', locality: 'Sudama Nagar', cluster: 'West', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore'], localitySpecificQuotesVerified: false },
  { id: 'rajendra-nagar', locality: 'Rajendra Nagar', cluster: 'West / south-west', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore'], localitySpecificQuotesVerified: false },
  { id: 'nipania', locality: 'Nipania', cluster: 'East / north-east', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/', 'https://hamaraservice.com/services-in-indore'], localitySpecificQuotesVerified: false },
  { id: 'bicholi-mardana', locality: 'Bicholi Mardana', cluster: 'South-east', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://hamaraservice.com/services-in-indore'], localitySpecificQuotesVerified: false },
  { id: 'super-corridor', locality: 'Super Corridor', cluster: 'North-west / airport corridor', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/'], localitySpecificQuotesVerified: false },
  { id: 'mr10-sukhliya', locality: 'MR-10 / Sukhlia', cluster: 'North / north-east', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/'], localitySpecificQuotesVerified: false },
  { id: 'bengali-square', locality: 'Bengali Square', cluster: 'South-east', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/'], localitySpecificQuotesVerified: false },
  { id: 'kanadia', locality: 'Kanadia Road', cluster: 'South-east', evidence: 'multi_locality_provider_listing', sourceUrls: ['https://www.plumberindore.in/'], localitySpecificQuotesVerified: false },
  { id: 'chandan-nagar', locality: 'Chandan Nagar', cluster: 'North-west', evidence: 'citywide_public_estimates_only', sourceUrls: ['https://genuinerate.com/rates/indore'], localitySpecificQuotesVerified: false },
  { id: 'nanda-nagar', locality: 'Nanda Nagar', cluster: 'North / central-east', evidence: 'citywide_public_estimates_only', sourceUrls: ['https://genuinerate.com/rates/indore'], localitySpecificQuotesVerified: false },
  { id: 'central-indore', locality: 'Central Indore / Rajwada', cluster: 'Central', evidence: 'citywide_public_estimates_only', sourceUrls: ['https://genuinerate.com/rates/indore'], localitySpecificQuotesVerified: false }
];
