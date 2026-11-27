import test from 'node:test';
import assert from 'node:assert/strict';
import { getSosReporterRole, isActiveSosBookingStatus, isValidSosIncidentInput } from '../src/utils/sosIncident';

test('accepts valid SOS incident input and all supported types', () => {
  for (const type of ['safety_concern', 'medical_emergency', 'harassment', 'other']) {
    assert.equal(isValidSosIncidentInput('booking_123', 'request-12345678', type, 'Help'), true);
  }
  assert.equal(isValidSosIncidentInput('booking_123', 'request-12345678', 'other', undefined), true);
});

test('rejects malformed IDs, unknown types, and oversized or non-string messages', () => {
  assert.equal(isValidSosIncidentInput('short', 'request-12345678', 'other', ''), false);
  assert.equal(isValidSosIncidentInput('booking_123', 'short', 'other', ''), false);
  assert.equal(isValidSosIncidentInput('booking_123', 'request-12345678', 'unknown', ''), false);
  assert.equal(isValidSosIncidentInput('booking_123', 'request-12345678', 'other', 'x'.repeat(501)), false);
  assert.equal(isValidSosIncidentInput('booking_123', 'request-12345678', 'other', 123), false);
});

test('only assigned, en-route, and in-progress bookings allow SOS reports', () => {
  for (const status of ['assigned', 'technician_en_route', 'in_progress']) assert.equal(isActiveSosBookingStatus(status), true);
  for (const status of ['requested', 'completed', 'cancelled', '', null, undefined]) assert.equal(isActiveSosBookingStatus(status), false);
});

test('identifies only the booking customer or assigned Channel Partner', () => {
  const booking = { customerUid: 'customer-1', technicianUid: 'partner-1' };
  assert.equal(getSosReporterRole(booking, 'customer-1'), 'CUSTOMER');
  assert.equal(getSosReporterRole(booking, 'partner-1'), 'CHANNEL_PARTNER');
  assert.equal(getSosReporterRole(booking, 'stranger'), null);
});
