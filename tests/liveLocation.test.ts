import test from 'node:test';
import assert from 'node:assert/strict';
import { areBothLocationConsentsEnabled, getBookingLocationParticipantRole, isLiveLocationBookingStatus } from '../src/utils/liveLocation';

test('only the customer and assigned partner are location participants', () => {
  const booking = { customerUid: 'customer-1', technicianUid: 'partner-1' };
  assert.equal(getBookingLocationParticipantRole(booking, 'customer-1'), 'customer');
  assert.equal(getBookingLocationParticipantRole(booking, 'partner-1'), 'partner');
  assert.equal(getBookingLocationParticipantRole(booking, 'stranger'), null);
  assert.equal(getBookingLocationParticipantRole(booking, ''), null);
});

test('location sharing is limited to active assigned bookings', () => {
  for (const status of ['assigned', 'technician_en_route', 'in_progress']) {
    assert.equal(isLiveLocationBookingStatus(status), true);
  }
  for (const status of ['requested', 'completed', 'cancelled', 'refunded', null, undefined]) {
    assert.equal(isLiveLocationBookingStatus(status), false);
  }
});

test('both participants must opt in before coordinates can be read', () => {
  assert.equal(areBothLocationConsentsEnabled({ customerEnabled: true, partnerEnabled: true }), true);
  assert.equal(areBothLocationConsentsEnabled({ customerEnabled: true, partnerEnabled: false }), false);
  assert.equal(areBothLocationConsentsEnabled({ customerEnabled: false, partnerEnabled: true }), false);
  assert.equal(areBothLocationConsentsEnabled(null), false);
});
