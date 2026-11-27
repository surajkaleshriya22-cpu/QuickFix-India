import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMERGENCY_CONTACT_LIMIT,
  EMERGENCY_CONTACT_OTP_TTL_MS,
  EMERGENCY_CONTACT_OTP_MAX_ATTEMPTS,
  EMERGENCY_CONTACT_OTP_RESEND_MS,
  EMERGENCY_CONTACT_OTP_PER_PHONE_PER_HOUR,
  EMERGENCY_CONTACT_OTP_PER_ACCOUNT_PER_HOUR,
  normalizeEmergencyPhone,
  isValidEmergencyPhone,
  emergencyContactDocId,
  maskEmergencyPhone,
  hashEmergencyContactOtp,
  verifyEmergencyContactOtpHash
} from '../src/utils/emergencyContacts';

test('emergency contact limits and expiry are conservative', () => {
  assert.equal(EMERGENCY_CONTACT_LIMIT, 3);
  assert.equal(EMERGENCY_CONTACT_OTP_TTL_MS, 300000);
  assert.equal(EMERGENCY_CONTACT_OTP_MAX_ATTEMPTS, 5);
  assert.equal(EMERGENCY_CONTACT_OTP_RESEND_MS, 60000);
  assert.equal(EMERGENCY_CONTACT_OTP_PER_PHONE_PER_HOUR, 3);
  assert.equal(EMERGENCY_CONTACT_OTP_PER_ACCOUNT_PER_HOUR, 5);
});

test('normalizes only string phone values and validates E.164 numbers', () => {
  assert.equal(normalizeEmergencyPhone(' +919876543210 '), '+919876543210');
  assert.equal(normalizeEmergencyPhone(9876543210), '');
  assert.equal(isValidEmergencyPhone('+919876543210'), true);
  assert.equal(isValidEmergencyPhone('9876543210'), false);
  assert.equal(isValidEmergencyPhone('+0123456789'), false);
  assert.equal(isValidEmergencyPhone('+1'), false);
});

test('contact document IDs are deterministic and scoped to account', () => {
  assert.equal(emergencyContactDocId('u1', '+919876543210'), emergencyContactDocId('u1', '+919876543210'));
  assert.notEqual(emergencyContactDocId('u1', '+919876543210'), emergencyContactDocId('u2', '+919876543210'));
  assert.notEqual(emergencyContactDocId('u1', '+919876543210'), emergencyContactDocId('u1', '+919876543211'));
  assert.match(emergencyContactDocId('u1', '+919876543210'), /^[a-f0-9]{64}$/);
});

test('phone masking never returns the full number', () => {
  assert.equal(maskEmergencyPhone('+919876543210'), '+91******210');
  assert.equal(maskEmergencyPhone('12345'), '******');
});

test('OTP hashes verify only the exact account, phone, salt and code', () => {
  const hash = hashEmergencyContactOtp('server-secret', 'u1', '+919876543210', '123456789', '001234');
  assert.equal(verifyEmergencyContactOtpHash(hash, hash), true);
  assert.equal(verifyEmergencyContactOtpHash(hash, 'not-a-hash'), false);
  const other = hashEmergencyContactOtp('server-secret', 'u1', '+919876543210', '123456789', '001235');
  assert.equal(verifyEmergencyContactOtpHash(other, hash), false);
});
