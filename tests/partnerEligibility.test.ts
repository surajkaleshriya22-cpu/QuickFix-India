import test from 'node:test';
import assert from 'node:assert/strict';
import { canPartnerReceiveBookingCategory, getPartnerServiceCategories, isPartnerEligibleForDispatch } from '../src/utils/partnerEligibility';

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
    ['ac_repair', 'appliance_repair', 'fridge_repair']
  );
});

test('maps Kaamkaaj Partner to one consolidated domestic-work category', () => {
  assert.deepEqual([...getPartnerServiceCategories(['kaamkaaj_partner'])], ['kaamkaaj_partner']);
});

test('maps legacy domestic-work registrations to Kaamkaaj Partner', () => {
  assert.deepEqual(
    [...getPartnerServiceCategories(['house_cleaning', 'cook', 'laundry', 'maid'])],
    ['kaamkaaj_partner']
  );
});

test('maps all other Channel Partner trades to their matching service categories', () => {
  const trades = [
    'electrician', 'plumber', 'welder', 'mechanic', 'driver', 'tourist_guide',
    'contractor', 'bike_taxi', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting'
  ];
  assert.deepEqual([...getPartnerServiceCategories(trades)].sort(), [...trades].sort());
});

test('keeps legacy AC/fridge and bike rider profiles dispatch-compatible', () => {
  assert.deepEqual(
    [...getPartnerServiceCategories(['ac_fridge', 'bike_rider'])].sort(),
    ['ac_repair', 'appliance_repair', 'bike_taxi', 'fridge_repair']
  );
});

test('ignores malformed and unknown partner trades', () => {
  assert.deepEqual([...getPartnerServiceCategories(null)], []);
  assert.deepEqual([...getPartnerServiceCategories(['unknown', 12, null])], []);
});


test('routes each order only to a partner registered for that service category', () => {
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], 'electrician'), true);
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], 'plumber'), false);
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], 'ac_repair'), false);
  assert.equal(canPartnerReceiveBookingCategory(['technician'], 'ac_repair'), true);
  assert.equal(canPartnerReceiveBookingCategory(['technician'], 'fridge_repair'), true);
  assert.equal(canPartnerReceiveBookingCategory(['technician'], 'electrician'), false);
  assert.equal(canPartnerReceiveBookingCategory(['plumber'], 'electrician'), false);
  assert.equal(canPartnerReceiveBookingCategory(['kaamkaaj_partner'], 'plumber'), false);
  assert.equal(canPartnerReceiveBookingCategory(['bike_taxi'], 'bike_taxi'), true);
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], ''), false);
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], null), false);
});


test('routes appliance repair orders to registered technicians only', () => {
  assert.equal(canPartnerReceiveBookingCategory(['technician'], 'appliance_repair'), true);
  assert.equal(canPartnerReceiveBookingCategory(['electrician'], 'appliance_repair'), false);
  assert.equal(canPartnerReceiveBookingCategory(['plumber'], 'appliance_repair'), false);
});
