import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBookingStart } from '../src/utils/bookingOtp.ts';

const validInput = {
  assignedPartnerUid: 'partner-123',
  bookingStatus: 'assigned',
  storedOtp: '004219',
  submittedOtp: '004219',
  partnerUid: 'partner-123'
};

test('accepts the assigned partner with the matching six-digit OTP', () => {
  assert.deepEqual(validateBookingStart(validInput), { valid: true });
});

test('rejects a different partner even when the OTP matches', () => {
  assert.deepEqual(
    validateBookingStart({ ...validInput, partnerUid: 'another-partner' }),
    { valid: false, reason: 'NOT_ASSIGNED_PARTNER' }
  );
});

test('rejects jobs that are not in an allowed start status', () => {
  for (const bookingStatus of ['requested', 'in_progress', 'completed', 'cancelled', '']) {
    assert.deepEqual(
      validateBookingStart({ ...validInput, bookingStatus }),
      { valid: false, reason: 'INVALID_START_STATUS' }
    );
  }
});

test('rejects an incorrect OTP', () => {
  assert.deepEqual(
    validateBookingStart({ ...validInput, submittedOtp: '004218' }),
    { valid: false, reason: 'INVALID_START_OTP' }
  );
});

test('rejects malformed OTP values', () => {
  for (const submittedOtp of ['4219', '0004219', '12a456', '', null]) {
    assert.deepEqual(
      validateBookingStart({ ...validInput, submittedOtp }),
      { valid: false, reason: 'INVALID_START_OTP' }
    );
  }
});

test('rejects a consumed OTP so it cannot start a second time', () => {
  assert.deepEqual(
    validateBookingStart({ ...validInput, storedOtp: '' }),
    { valid: false, reason: 'INVALID_START_OTP' }
  );
});

test('rejects an OTP belonging to a different booking record', () => {
  assert.deepEqual(
    validateBookingStart({ ...validInput, storedOtp: '888888' }),
    { valid: false, reason: 'INVALID_START_OTP' }
  );
});
