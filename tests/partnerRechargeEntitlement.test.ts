import test from 'node:test';
import assert from 'node:assert/strict';
import { isPartnerRechargeEntitled } from '../src/utils/partnerRechargeEntitlement';

const now = Date.parse('2026-11-25T12:00:00.000Z');
const policy = { paymentEnabled: true, dutyGatingEnabled: true, freeTrialDays: 30 };

test('allows an approved account during its active free trial', () => {
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 5 * 86400000) }, policy, undefined, now), true);
});

test('blocks an expired trial when there is no verified active recharge', () => {
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 31 * 86400000) }, policy, undefined, now), false);
});

test('allows an expired trial with a future server-ledger recharge expiry', () => {
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 60 * 86400000) }, policy, { activeUntil: new Date(now + 10 * 86400000) }, now), true);
});

test('blocks an expired trial with an expired recharge', () => {
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 60 * 86400000) }, policy, { activeUntil: new Date(now - 1) }, now), false);
});

test('fails closed for missing or malformed profile dates while duty gating is enabled', () => {
  assert.equal(isPartnerRechargeEntitled(undefined, policy, undefined, now), false);
  assert.equal(isPartnerRechargeEntitled({}, policy, undefined, now), false);
  assert.equal(isPartnerRechargeEntitled({ createdAt: 'not-a-date' }, policy, undefined, now), false);
});

test('keeps the launch default fail-open when rollout flags are omitted', () => {
  const launchDefaultPolicy = { freeTrialDays: 30 };
  const expiredProfile = { createdAt: new Date(now - 60 * 86400000) };
  assert.equal(isPartnerRechargeEntitled(expiredProfile, launchDefaultPolicy, undefined, now), true);
});

test('keeps duty gating disabled until payment and duty-gating rollout flags are both enabled', () => {
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 60 * 86400000) }, { ...policy, paymentEnabled: false }, undefined, now), true);
  assert.equal(isPartnerRechargeEntitled({ createdAt: new Date(now - 60 * 86400000) }, { ...policy, dutyGatingEnabled: false }, undefined, now), true);
});
