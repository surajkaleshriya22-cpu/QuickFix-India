import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePartnerRechargePolicy } from '../src/utils/partnerRechargePolicy.ts';

const validPolicy = {
  trialDays: 30,
  packages: [
    { id: 'monthly-30', name: 'Monthly plan', amountRupees: 500, durationDays: 30, active: true },
    { id: 'quarterly-90', name: 'Quarterly plan', amountRupees: 1200, durationDays: 90, active: false }
  ]
};

test('accepts valid recharge policy and trims package names', () => {
  const result = validatePartnerRechargePolicy({
    ...validPolicy,
    packages: [{ ...validPolicy.packages[0], name: '  Monthly plan  ' }]
  });
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.value.packages[0].name, 'Monthly plan');
});

test('accepts zero free-trial days and maximum supported trial days', () => {
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, trialDays: 0 }).valid, true);
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, trialDays: 365 }).valid, true);
});

test('rejects malformed policy and out-of-range trial days', () => {
  for (const input of [null, [], {}, { ...validPolicy, trialDays: -1 }, { ...validPolicy, trialDays: 366 }, { ...validPolicy, trialDays: 1.5 }]) {
    assert.equal(validatePartnerRechargePolicy(input).valid, false);
  }
});

test('requires between one and twenty packages', () => {
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, packages: [] }).valid, false);
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, packages: Array.from({ length: 21 }, (_, i) => ({ ...validPolicy.packages[0], id: 'p' + i })) }).valid, false);
});

test('rejects duplicate or unsafe package IDs', () => {
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, packages: [validPolicy.packages[0], validPolicy.packages[0]] }).valid, false);
  assert.equal(validatePartnerRechargePolicy({ ...validPolicy, packages: [{ ...validPolicy.packages[0], id: '../admin' }] }).valid, false);
});

test('rejects invalid prices, validity periods, names and active flags', () => {
  const invalidPackages = [
    { ...validPolicy.packages[0], name: ' ' },
    { ...validPolicy.packages[0], name: 'x'.repeat(81) },
    { ...validPolicy.packages[0], amountRupees: 0 },
    { ...validPolicy.packages[0], amountRupees: 1000001 },
    { ...validPolicy.packages[0], amountRupees: 10.5 },
    { ...validPolicy.packages[0], durationDays: 0 },
    { ...validPolicy.packages[0], durationDays: 3651 },
    { ...validPolicy.packages[0], active: 'yes' }
  ];
  for (const pkg of invalidPackages) {
    assert.equal(validatePartnerRechargePolicy({ ...validPolicy, packages: [pkg] }).valid, false);
  }
});
