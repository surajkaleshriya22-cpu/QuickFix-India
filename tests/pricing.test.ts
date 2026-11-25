import test from 'node:test';
import assert from 'node:assert/strict';
import { getBillingProfile } from '../src/data/pricing';

const service = (id: string, title: string) => ({ id, title, category: 'electrician' as const });

test('fan and MCB installation are priced per installed unit', () => {
  assert.equal(getBillingProfile(service('elec-fan-install', 'Ceiling Fan Installation')).unit, 'per_piece');
  assert.equal(getBillingProfile(service('elec-mcb-install', 'MCB Installation')).unit, 'per_piece');
});

test('light installation is priced per light point', () => {
  assert.equal(getBillingProfile(service('elec-light-install', 'Light Fitting Installation')).unit, 'per_point');
});
