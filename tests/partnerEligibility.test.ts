import test from 'node:test';
import assert from 'node:assert/strict';
import { getPartnerServiceCategories, isPartnerEligibleForDispatch } from '../src/utils/partnerEligibility';

const eligible = {
  role: 'CHANNEL_PARTNER',
  approvalStatus: 'approved',
  isVerified: true,
  isOnline: true,
  isSuspended: false,
  securityDepositPaid: true,
  walletBalance: 2500
};

test('allows a fully approved and funded active partner', () => {
  assert.equal(isPartnerEligibleForDispatch(eligible), true);
});

test('blocks suspended partners even when all other checks pass', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, isSuspended: true }), false);
});

test('blocks reserve below ₹2,000 and non-numeric wallet values', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, walletBalance: 1999 }), false);
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, walletBalance: '2500' }), false);
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, walletBalance: Number.NaN }), false);
});

test('blocks unapproved, unverified, offline, unpaid and non-partner profiles', () => {
  for (const patch of [
    { approvalStatus: 'basic_profile_approved' },
    { isVerified: false },
    { isOnline: false },
    { securityDepositPaid: false },
    { role: 'CUSTOMER' }
  ]) {
    assert.equal(isPartnerEligibleForDispatch({ ...eligible, ...patch }), false);
  }
});

test('maps Technician to both AC and fridge bookings', () => {
  assert.deepEqual(
    [...getPartnerServiceCategories(['technician'])].sort(),
    ['ac_repair', 'fridge_repair']
  );
});

test('maps every new Channel Partner trade to its matching service category', () => {
  const trades = [
    'electrician', 'plumber', 'welder', 'mechanic', 'driver', 'tourist_guide',
    'contractor', 'bike_taxi', 'house_cleaning', 'cook', 'laundry', 'maid',
    'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting'
  ];
  assert.deepEqual([...getPartnerServiceCategories(trades)].sort(), [...trades].sort());
});

test('keeps legacy AC/fridge and bike rider profiles dispatch-compatible', () => {
  assert.deepEqual(
    [...getPartnerServiceCategories(['ac_fridge', 'bike_rider'])].sort(),
    ['ac_repair', 'bike_taxi', 'fridge_repair']
  );
});

test('ignores malformed and unknown partner trades', () => {
  assert.deepEqual([...getPartnerServiceCategories(null)], []);
  assert.deepEqual([...getPartnerServiceCategories(['unknown', 12, null])], []);
});
