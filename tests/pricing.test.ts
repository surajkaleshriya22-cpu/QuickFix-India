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

test('car washing tasks use per-vehicle or inspection quote billing', () => {
  assert.equal(getBillingProfile({ id: 'car-wash-full-service', title: 'Complete car wash', category: 'car_wash' }).unit, 'per_job');
  assert.equal(getBillingProfile({ id: 'car-wash-detailing', title: 'Car polishing and detailing', category: 'car_wash' }).unit, 'quote');
});

test('transport services distinguish simple trips from load-based vehicle quotes', () => {
  assert.equal(getBillingProfile({ id: 'transport-shop-delivery', title: 'Shop purchase pickup and home delivery', category: 'transport' }).unit, 'per_trip');
  assert.equal(getBillingProfile({ id: 'transport-mini-truck', title: 'Mini truck and house shifting transport', category: 'transport' }).unit, 'quote');
});
