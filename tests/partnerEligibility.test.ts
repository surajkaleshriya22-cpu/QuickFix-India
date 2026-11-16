import test from 'node:test';
import assert from 'node:assert/strict';
import { isPartnerEligibleForDispatch } from '../src/utils/partnerEligibility';

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
