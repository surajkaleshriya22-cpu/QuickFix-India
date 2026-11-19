import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceBetweenPointsKm, isWithinPartnerDispatchRadius } from '../src/utils/geo';

const partner = {
  dispatchLocation: { latitude: 22.7196, longitude: 75.8577 },
};

test('calculates zero distance for the same coordinates', () => {
  assert.equal(distanceBetweenPointsKm(
    { latitude: 22.7196, longitude: 75.8577 },
    { latitude: 22.7196, longitude: 75.8577 }
  ), 0);
});

test('calculates a plausible distance between Indore and Bhopal', () => {
  const distance = distanceBetweenPointsKm(
    { latitude: 22.7196, longitude: 75.8577 },
    { latitude: 23.2599, longitude: 77.4126 }
  );
  assert.ok(distance > 170 && distance < 200);
});

test('allows customer bookings within the 7 km default limit', () => {
  assert.equal(isWithinPartnerDispatchRadius(partner, {
    customerLocation: { latitude: 22.73, longitude: 75.86 },
  }), true);
});

test('blocks customer bookings beyond 7 km even if partner configured a larger radius', () => {
  assert.equal(isWithinPartnerDispatchRadius(
    { ...partner, dispatchRadiusKm: 25 },
    { customerLocation: { latitude: 22.80, longitude: 75.86 } }
  ), false);
});

test('honours a partner configured radius smaller than 7 km', () => {
  assert.equal(isWithinPartnerDispatchRadius(
    { ...partner, dispatchRadiusKm: 2 },
    { customerLocation: { latitude: 22.73, longitude: 75.86 } }
  ), false);
});

test('fails closed when partner or customer GPS coordinates are missing or invalid', () => {
  assert.equal(isWithinPartnerDispatchRadius({}, {}), false);
  assert.equal(isWithinPartnerDispatchRadius(partner, {}), false);
  assert.equal(isWithinPartnerDispatchRadius(
    { ...partner, dispatchRadiusKm: 0 },
    { customerLocation: { latitude: 22.72, longitude: 75.86 } }
  ), false);
});
