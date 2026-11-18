import { ServiceItem } from '../types';

export type BillingUnit = 'per_visit' | 'per_point' | 'per_piece' | 'per_hour' | 'per_day' | 'per_sqft' | 'per_kg' | 'per_km' | 'per_trip' | 'per_job' | 'quote';

export interface BillingProfile {
  unit: BillingUnit;
  label: string;
  hindiLabel: string;
  quantityPrompt: string;
  hindiQuantityPrompt: string;
  quoteRequired?: boolean;
  note: string;
}

/** Billing basis only. Prices must come from an approved location-specific rate card. */
export function getBillingProfile(service: Pick<ServiceItem, 'category' | 'title' | 'id'>): BillingProfile {
  const title = service.title.toLowerCase();
  const category = service.category;
  if (category === 'bike_taxi') return { unit: 'per_km', label: 'Base fare + per km', hindiLabel: 'बेस किराया + प्रति किमी', quantityPrompt: 'Trip distance (km)', hindiQuantityPrompt: 'दूरी (किमी)', note: 'Waiting time and minimum fare must be shown separately.' };
  if (category === 'driver') return { unit: 'per_hour', label: 'Per hour / 8-hour day', hindiLabel: 'प्रति घंटा / 8 घंटे का दिन', quantityPrompt: 'Hours required', hindiQuantityPrompt: 'कितने घंटे', note: 'Overtime, outstation travel and allowance are separate.' };
  if (category === 'tourist_guide') return { unit: 'quote', label: 'Tour duration and language quote', hindiLabel: 'समय और भाषा के अनुसार कोटेशन', quantityPrompt: 'Tour plan and hours', hindiQuantityPrompt: 'टूर योजना और घंटे', quoteRequired: true, note: 'Guide credentials, language, itinerary and half/full-day duration must be confirmed; entry tickets and travel are separate.' };
  if (category === 'contractor') return { unit: 'quote', label: 'Measured estimate / BOQ', hindiLabel: 'माप और काम के हिसाब से कोटेशन', quantityPrompt: 'Site measurement required', hindiQuantityPrompt: 'साइट का माप जरूरी', quoteRequired: true, note: 'Site inspection and customer-approved itemised quotation required.' };
  if (category === 'welder') return { unit: 'per_kg', label: 'Per kg / running foot / item', hindiLabel: 'प्रति किलो / रनिंग फीट / सामान', quantityPrompt: 'Measured quantity', hindiQuantityPrompt: 'मापी गई मात्रा', note: 'Custom fabrication requires a measured quote; steel and consumables are separate.' };
  if (category === 'painter') return { unit: 'per_sqft', label: 'Per sq. ft. labour', hindiLabel: 'प्रति वर्ग फुट मजदूरी', quantityPrompt: 'Area (sq. ft.)', hindiQuantityPrompt: 'क्षेत्रफल (वर्ग फुट)', note: 'Paint, primer, putty, scaffolding and surface repairs are separate unless itemised.' };\n  if (category === 'pest_control' || category === 'house_cleaning') return { unit: 'per_job', label: 'Per home / BHK package', hindiLabel: 'प्रति घर / BHK पैकेज', quantityPrompt: 'Home size / BHK', hindiQuantityPrompt: 'घर का आकार / BHK', note: 'Treatment or cleaning scope, consumables and warranty must be stated before booking.' };
  if (category === 'house_shifting') return { unit: 'per_trip', label: 'Per trip + distance + load', hindiLabel: 'प्रति ट्रिप + दूरी + सामान', quantityPrompt: 'Trips / distance', hindiQuantityPrompt: 'ट्रिप / दूरी', note: 'Vehicle size, floors, helpers and packing materials affect the quote.' };
  if (category === 'kaamkaaj_partner') return { unit: 'quote', label: 'Task list and duration quote', hindiLabel: 'काम और समय के अनुसार कोटेशन', quantityPrompt: 'Tasks, hours and frequency', hindiQuantityPrompt: 'काम, घंटे और कितनी बार', quoteRequired: true, note: 'Daily sweeping, mopping, utensils, cooking, laundry and care tasks vary by home size and schedule; publish fixed rates only after local worker quotations.' };\n  if (category === 'cook' || category === 'laundry' || category === 'maid') {
    if (title.includes('laundry') || title.includes('iron')) return { unit: 'per_kg', label: 'Per kg / piece', hindiLabel: 'प्रति किलो / कपड़ा', quantityPrompt: 'Weight or pieces', hindiQuantityPrompt: 'वजन या कपड़ों की संख्या', note: 'Pickup, detergent and ironing must be itemised.' };
    if (title.includes('clean') || title.includes('sweep') || title.includes('mop')) return { unit: 'per_visit', label: 'Per visit / room / day', hindiLabel: 'प्रति विजिट / कमरा / दिन', quantityPrompt: 'Rooms or visits', hindiQuantityPrompt: 'कमरे या विजिट', note: 'Home size and task list determine the final rate.' };
    if (title.includes('cook')) return { unit: 'per_visit', label: 'Per meal / visit / hour', hindiLabel: 'प्रति भोजन / विजिट / घंटा', quantityPrompt: 'Meals or visits', hindiQuantityPrompt: 'भोजन या विजिट', note: 'Number of people, meals and menu complexity affect the rate.' };
    return { unit: 'per_hour', label: 'Per hour / day / visit', hindiLabel: 'प्रति घंटा / दिन / विजिट', quantityPrompt: 'Hours or days', hindiQuantityPrompt: 'घंटे या दिन', note: 'Task list and duration must be agreed before work starts.' };
  }
  if (category === 'mechanic') return { unit: 'quote', label: 'Inspection then repair quote', hindiLabel: 'जाँच के बाद मरम्मत का कोटेशन', quantityPrompt: 'Vehicle and fault details', hindiQuantityPrompt: 'वाहन और खराबी का विवरण', quoteRequired: true, note: 'Two-wheeler and car labour differ materially; confirm vehicle type, fault and parts before quoting.' };\n  if (category === 'carpenter' || category === 'gardener') return { unit: 'per_job', label: 'Per job / visit', hindiLabel: 'प्रति काम / विजिट', quantityPrompt: 'Job quantity', hindiQuantityPrompt: 'काम की मात्रा', note: 'Parts, materials and larger jobs are separately itemised after inspection.' };
  if (category === 'electrician') return { unit: title.includes('switch') || title.includes('light') ? 'per_point' : 'per_visit', label: title.includes('switch') || title.includes('light') ? 'Per point / fitting' : 'Per visit / diagnosis', hindiLabel: title.includes('switch') || title.includes('light') ? 'प्रति पॉइंट / फिटिंग' : 'प्रति विजिट / जांच', quantityPrompt: 'Points or fittings', hindiQuantityPrompt: 'पॉइंट या फिटिंग', note: 'Wires, switches and replacement parts are separate unless listed.' };
  if (category === 'plumber') return { unit: 'per_visit', label: 'Per visit / diagnosis', hindiLabel: 'प्रति विजिट / जांच', quantityPrompt: 'Visits', hindiQuantityPrompt: 'विजिट', note: 'Visit/inspection is separate from repair labour, pipes, fittings and replacement parts; itemise and confirm before work.' };
  if (category === 'ac_repair' || category === 'fridge_repair' || category === 'technician') return { unit: 'per_job', label: 'Per appliance / repair job', hindiLabel: 'प्रति उपकरण / मरम्मत', quantityPrompt: 'Appliances', hindiQuantityPrompt: 'उपकरणों की संख्या', note: 'Diagnosis, refrigerant and spare parts must be itemised separately.' };
  return { unit: 'per_visit', label: 'Per visit (final scope to confirm)', hindiLabel: 'प्रति विजिट (काम तय होने पर)', quantityPrompt: 'Visits', hindiQuantityPrompt: 'विजिट', note: 'Final amount must be confirmed with the customer before work begins.' };
}

export const formatBillingUnit = (unit: BillingUnit): string => ({
  per_visit: 'visit', per_point: 'point', per_piece: 'piece', per_hour: 'hour', per_day: 'day', per_sqft: 'sq. ft.', per_kg: 'kg', per_km: 'km', per_trip: 'trip', per_job: 'job', quote: 'quotation'
})[unit];
