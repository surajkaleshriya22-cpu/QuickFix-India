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

import { getCustomerVisibleStartOtp } from '../src/utils/bookingOtp.ts';

const visibleOtpInput = {
  bookingCustomerUid: 'customer-1',
  bookingPartnerUid: 'partner-1',
  bookingStatus: 'assigned',
  privateCustomerUid: 'customer-1',
  privatePartnerUid: 'partner-1',
  storedOtp: '004219',
  customerUid: 'customer-1'
};

test('shows OTP only to the customer and partner recorded in the private booking record', () => {
  assert.equal(getCustomerVisibleStartOtp(visibleOtpInput), '004219');
});

test('does not disclose OTP if the private record belongs to another customer', () => {
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, privateCustomerUid: 'other-customer' }), '');
});

test('does not disclose OTP if the private record belongs to another partner', () => {
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, privatePartnerUid: 'other-partner' }), '');
});

test('does not disclose OTP if the booking ownership no longer matches', () => {
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, bookingCustomerUid: 'other-customer' }), '');
});

test('does not disclose OTP after the job starts or the OTP is consumed', () => {
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, bookingStatus: 'in_progress' }), '');
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, storedOtp: '' }), '');
});

test('does not disclose malformed private OTP values', () => {
  assert.equal(getCustomerVisibleStartOtp({ ...visibleOtpInput, storedOtp: '12345x' }), '');
});
