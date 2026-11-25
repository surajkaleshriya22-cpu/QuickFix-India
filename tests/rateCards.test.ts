import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRateQuote, resolveLocationRateCard, type LocationRateCard } from '../src/data/rateCards';

const baseCard: LocationRateCard = {
  id: 'mp-indore-electrician-hour',
  state: 'Madhya Pradesh',
  district: 'Indore',
  city: 'Indore',
  serviceCategory: 'electrician',
  unit: 'per_hour',
  currency: 'INR',
  minimumRate: 180,
  maximumRate: 250,
  minimumCharge: 250,
  materialsIncluded: false,
  approvalStatus: 'approved',
  effectiveFrom: '2026-11-01',
  sourceName: 'Admin verified local survey',
  sourceCheckedAt: '2026-11-01',
  notes: 'Test fixture only; not a published QuickFix rate.'
};

test('rate lookup selects the most specific approved locality card', () => {
  const tehsilCard = { ...baseCard, id: 'rau-specific', tehsil: 'Rau', minimumRate: 200, maximumRate: 280 };
  const result = resolveLocationRateCard(
    [baseCard, tehsilCard],
    { state: 'Madhya Pradesh', district: 'Indore', city: 'Indore', tehsil: 'Rau' },
    'electrician', 'elec-fan', 'per_hour', '2026-11-18'
  );
  assert.equal(result?.id, 'rau-specific');
});

test('rate lookup never uses draft, expired or wrong location cards', () => {
  const result = resolveLocationRateCard(
    [{ ...baseCard, approvalStatus: 'draft' }, { ...baseCard, id: 'expired', effectiveTo: '2026-10-31' }],
    { state: 'Madhya Pradesh', district: 'Indore', city: 'Indore' },
    'electrician', 'elec-fan', 'per_hour', '2026-11-18'
  );
  assert.equal(result, null);
});

test('quote calculation applies minimum charge and base fee', () => {
  const quote = calculateRateQuote({
    unit: 'per_km', minimumRate: 10, maximumRate: 12, minimumCharge: 50,
    baseFee: 20, materialsIncluded: false
  }, 2);
  assert.equal(quote.totalMinimum, 50);
  assert.equal(quote.totalMaximum, 50);
  assert.equal(quote.baseFee, 20);
});

test('quote calculation rejects invalid quantities and inverted rate ranges', () => {
  assert.throws(() => calculateRateQuote({
    unit: 'per_day', minimumRate: 100, maximumRate: 90, minimumCharge: 0, materialsIncluded: false
  }, 1), /Maximum rate/);
  assert.throws(() => calculateRateQuote({
    unit: 'per_day', minimumRate: 100, maximumRate: 120, minimumCharge: 0, materialsIncluded: false
  }, 0), /positive number/);
});


test('percentage adjustment changes per-km and per-square-foot rates', () => {
  const km = calculateRateQuote({ unit: 'per_km', minimumRate: 100, maximumRate: 100, minimumCharge: 100, materialsIncluded: false, percentageAdjustment: 10 }, 1);
  assert.equal(km.rateMinimum, 110);
  assert.equal(km.totalMinimum, 110);
  assert.equal(km.appliedAdjustmentPercent, 10);
  const sqft = calculateRateQuote({ unit: 'per_sqft', minimumRate: 100, maximumRate: 100, minimumCharge: 100, materialsIncluded: false, percentageAdjustment: -10 }, 1);
  assert.equal(sqft.rateMinimum, 90);
  assert.equal(sqft.totalMinimum, 90);
});

test('percentage adjustment rejects values outside the safe range', () => {
  assert.throws(() => calculateRateQuote({ unit: 'per_point', minimumRate: 100, maximumRate: 100, minimumCharge: 100, materialsIncluded: false, percentageAdjustment: -101 }, 1), /between -100% and \+500%/);
});
