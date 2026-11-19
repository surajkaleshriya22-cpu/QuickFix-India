import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceBetweenPointsKm, isWithinPartnerDispatchRadius } from '../src/utils/geo';

test('calculates zero distance for the same coordinates', () => {
  assert.equal(distanceBetweenPointsKm(
    { latitude: 22.7196, longitude: 75.8577 },
    { latitude: 22.7196, longitude: 75.8577 }
  ), 0);
});

test('calculates a plausible distance between two cities', () => {
  const distance = distanceBetweenPointsKm(
    { latitude: 22.7196, longitude: 75.8577 },
    { latitude: 23.2599, longitude: 77.4126 }
  );
  assert.ok(distance > 170 && distance < 200);
});

test('allows bookings inside a configured partner radius', () => {
  assert.equal(isWithinPartnerDispatchRadius(
    { dispatchLocation: { latitude: 22.7196, longitude: 75.8577 }, dispatchRadiusKm: 15 },
    { customerLocation: { latitude: 22.73, longitude: 75.86 } }
  ), true);
});

test('blocks bookings outside a configured partner radius', () => {
  assert.equal(isWithinPartnerDispatchRadius(
    { dispatchLocation: { latitude: 22.7196, longitude: 75.8577 }, dispatchRadiusKm: 15 },
    { customerLocation: { latitude: 23.2599, longitude: 77.4126 } }
  ), false);
});

test('fails closed when a configured geofence has missing or invalid coordinates', () => {
  const partner = { dispatchLocation: { latitude: 22.7196, longitude: 75.8577 }, dispatchRadiusKm: 15 };
  assert.equal(isWithinPartnerDispatchRadius(partner, {}), false);
  assert.equal(isWithinPartnerDispatchRadius(
    { ...partner, dispatchRadiusKm: 0 },
    { customerLocation: { latitude: 22.72, longitude: 75.86 } }
  ), false);
});

test('preserves legacy area-only matching when no geofence is configured', () => {
  assert.equal(isWithinPartnerDispatchRadius({}, {}), true);
});
