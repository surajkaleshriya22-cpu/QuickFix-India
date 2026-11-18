import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPartnerDispatchCategories,
  isBookingWithinPartnerScope
} from '../src/utils/partnerCategories';

const allCategories = getPartnerDispatchCategories([
  'electrician', 'plumber', 'technician', 'welder', 'mechanic',
  'driver', 'tourist_guide', 'contractor', 'bike_rider', 'labour'
]);

const base = {
  partnerCity: 'Indore',
  bookingCity: 'indore',
  partnerCategories: allCategories,
  bookingCategory: 'electrician',
  partnerArea: { state: 'Madhya Pradesh', district: 'Indore', tehsil: 'Rau' },
  bookingArea: { state: 'madhya pradesh', district: 'INDORE', tehsil: 'rau' }
};

test('maps legacy AC and fridge partner trades to Technician', () => {
  const categories = getPartnerDispatchCategories(['AC_REPAIR', 'fridge_repair', 'ac_fridge']);
  assert.deepEqual([...categories], ['technician']);
});

test('supports all ten partner categories without cross-category leakage', () => {
  for (const category of allCategories) {
    assert.equal(isBookingWithinPartnerScope({ ...base, bookingCategory: category }), true, category);
  }
  assert.equal(isBookingWithinPartnerScope({ ...base, bookingCategory: 'unknown_trade' }), false);
});

test('matches city and structured service areas case-insensitively', () => {
  assert.equal(isBookingWithinPartnerScope(base), true);
  assert.equal(isBookingWithinPartnerScope({
    ...base,
    bookingArea: { ...base.bookingArea, tehsil: 'Mhow' }
  }), false);
});

test('blocks mismatched cities and categories', () => {
  assert.equal(isBookingWithinPartnerScope({ ...base, bookingCity: 'Ujjain' }), false);
  assert.equal(isBookingWithinPartnerScope({ ...base, partnerCategories: new Set(['plumber']) }), false);
});

test('allows city-scoped legacy records when structured service area is incomplete', () => {
  assert.equal(isBookingWithinPartnerScope({ ...base, bookingArea: { district: 'Indore' } }), true);
  assert.equal(isBookingWithinPartnerScope({ ...base, partnerArea: null }), true);
});

test('rejects missing city even when category matches', () => {
  assert.equal(isBookingWithinPartnerScope({ ...base, partnerCity: '' }), false);
});
