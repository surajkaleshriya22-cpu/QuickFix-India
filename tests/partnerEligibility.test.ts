import test from 'node:test';
import assert from 'node:assert/strict';
import { canActivatePartnerDuty, canPartnerReceiveBookingCategory, getPartnerServiceCategories, isPartnerEligibleForDispatch } from '../src/utils/partnerEligibility';

const eligible = {
  role: 'CHANNEL_PARTNER',
  approvalStatus: 'approved',
  isVerified: true,
  isOnline: true,
  isSuspended: false,
  securityDepositPaid: false,
  walletBalance: 0
};

const activationEligible = {
  role: 'CHANNEL_PARTNER',
  approvalStatus: 'approved',
  isVerified: true,
  isSuspended: false,
  securityDepositPaid: false,
  walletBalance: 0,
  subscriptionStatus: 'trial',
  subscriptionExpiresAt: new Date(Date.now() + 86400000)
};

test('recognizes partner membership in roles[] when the primary role is CUSTOMER', () => {
  const multiRoleActivation = { ...activationEligible, role: 'CUSTOMER', roles: ['CUSTOMER', 'CHANNEL_PARTNER'] };
  const multiRoleDispatch = { ...eligible, role: 'CUSTOMER', roles: ['CUSTOMER', 'CHANNEL_PARTNER'] };
  assert.equal(canActivatePartnerDuty(multiRoleActivation), true);
  assert.equal(isPartnerEligibleForDispatch(multiRoleDispatch), true);
  assert.equal(canActivatePartnerDuty({ ...multiRoleActivation, roles: ['CUSTOMER'] }), false);
  assert.equal(isPartnerEligibleForDispatch({ ...multiRoleDispatch, roles: ['CUSTOMER'] }), false);
});

test('allows online duty for approved and verified subscribed partners without a wallet reserve', () => {
  assert.equal(canActivatePartnerDuty(activationEligible), true);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, walletBalance: 0, securityDepositPaid: false }), true);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, approvalStatus: 'pending_audit' }), false);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, isVerified: false }), false);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, isSuspended: true }), false);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, role: 'CUSTOMER' }), false);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, subscriptionStatus: 'expired' }), false);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, subscriptionExpiresAt: new Date(Date.now() - 1000) }), false);
});

test('legacy wallet balance values do not affect online duty activation', () => {
  assert.equal(canActivatePartnerDuty({ ...activationEligible, walletBalance: 'invalid' }), true);
  assert.equal(canActivatePartnerDuty({ ...activationEligible, walletBalance: Number.NaN }), true);
});

test('allows a fully approved and funded active partner', () => {
  assert.equal(isPartnerEligibleForDispatch(eligible), true);
});

test('blocks partners whose paid or trial subscription has expired', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, subscriptionStatus: 'trial', subscriptionExpiresAt: new Date(Date.now() - 1000) }), false);
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, subscriptionStatus: 'expired' }), false);
});

test('allows active subscriptions and preserves existing legacy profiles without subscription fields', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, subscriptionStatus: 'active', subscriptionExpiresAt: new Date(Date.now() + 86400000) }), true);
  assert.equal(isPartnerEligibleForDispatch(eligible), true);
});

test('blocks suspended partners even when all other checks pass', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, isSuspended: true }), false);
});

test('legacy reserve and wallet values never block partner dispatch', () => {
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, walletBalance: 0, securityDepositPaid: false }), true);
  assert.equal(isPartnerEligibleForDispatch({ ...eligible, walletBalance: 'invalid', securityDepositPaid: undefined }), true);
});

test('blocks unapproved, unverified, offline and non-partner profiles', () => {
  for (const patch of [
    { approvalStatus: 'basic_profile_approved' },
    { isVerified: false },
    { isOnline: false },
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
test('dispatches Car Washing and Transport partners only to their matching service categories', () => {
  assert.deepEqual([...getPartnerServiceCategories(['car_wash', 'transport'])].sort(), ['car_wash', 'transport']);
  assert.equal(canPartnerReceiveBookingCategory(['car_wash'], 'car_wash'), true);
  assert.equal(canPartnerReceiveBookingCategory(['transport'], 'transport'), true);
  assert.equal(canPartnerReceiveBookingCategory(['car_wash'], 'transport'), false);
});
