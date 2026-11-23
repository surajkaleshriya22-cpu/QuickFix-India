import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePartnerBookingCommission,
  calculatePartnerServiceEarning
} from '../src/utils/partnerMonetization';

test('partner booking commission is zero for every booking value', () => {
  for (const amount of [0, 100, 500, 2500, 100000]) {
    assert.equal(calculatePartnerBookingCommission(amount), 0);
  }
});

test('partner receives the full listed service price before separate customer-side charges and taxes', () => {
  assert.equal(calculatePartnerServiceEarning(0), 0);
  assert.equal(calculatePartnerServiceEarning(499), 499);
  assert.equal(calculatePartnerServiceEarning(1250), 1250);
});

test('invalid service prices cannot create partner earnings', () => {
  assert.equal(calculatePartnerServiceEarning(-1), 0);
  assert.equal(calculatePartnerServiceEarning(Number.NaN), 0);
  assert.equal(calculatePartnerServiceEarning(Number.POSITIVE_INFINITY), 0);
});
