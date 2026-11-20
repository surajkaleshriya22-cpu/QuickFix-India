import test from 'node:test';
import assert from 'node:assert/strict';
import { isStartOtpBookingStatus, isStartOtpExpired, isValidStartOtp } from '../src/utils/bookingOtp';

test('OTP is available for assigned and en-route bookings', () => {
  assert.equal(isStartOtpBookingStatus('assigned'), true);
  assert.equal(isStartOtpBookingStatus('technician_en_route'), true);
});

test('OTP is unavailable for unassigned and terminal booking states', () => {
  for (const status of ['requested', 'in_progress', 'completed', 'cancelled', null, undefined]) {
    assert.equal(isStartOtpBookingStatus(status), false);
  }
});

test('OTP expiry rejects expired, equal-to-now and malformed timestamps', () => {
  const now = Date.parse('2026-11-20T12:00:00.000Z');
  assert.equal(isStartOtpExpired('2026-11-20T11:59:59.999Z', now), true);
  assert.equal(isStartOtpExpired('2026-11-20T12:00:00.000Z', now), true);
  assert.equal(isStartOtpExpired('not-a-date', now), true);
  assert.equal(isStartOtpExpired(null, now), true);
});

test('OTP expiry accepts a future timestamp', () => {
  const now = Date.parse('2026-11-20T12:00:00.000Z');
  assert.equal(isStartOtpExpired('2026-11-20T12:00:00.001Z', now), false);
});

test('only exactly six numeric digits are valid OTP values', () => {
  for (const otp of ['000000', '123456', '999999']) assert.equal(isValidStartOtp(otp), true);
  for (const otp of ['12345', '1234567', '12a456', '', 123456, null, ' 12345']) {
    assert.equal(isValidStartOtp(otp), false);
  }
});
