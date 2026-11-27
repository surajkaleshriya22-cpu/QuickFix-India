import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const EMERGENCY_CONTACT_LIMIT = 3;
export const EMERGENCY_CONTACT_OTP_TTL_MS = 5 * 60 * 1000;
export const EMERGENCY_CONTACT_OTP_MAX_ATTEMPTS = 5;
export const EMERGENCY_CONTACT_OTP_RESEND_MS = 60 * 1000;
export const EMERGENCY_CONTACT_OTP_PER_PHONE_PER_HOUR = 3;
export const EMERGENCY_CONTACT_OTP_PER_ACCOUNT_PER_HOUR = 5;

export const normalizeEmergencyPhone = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const isValidEmergencyPhone = (value: string): boolean =>
  /^\+[1-9]\d{7,14}$/.test(value);

export const emergencyContactDocId = (uid: string, phone: string): string =>
  createHash('sha256').update(uid + ':' + phone).digest('hex');

export const maskEmergencyPhone = (phone: string): string =>
  phone.length >= 6 ? phone.slice(0, 3) + '******' + phone.slice(-3) : '******';

export const hashEmergencyContactOtp = (
  pepper: string,
  uid: string,
  phone: string,
  salt: string,
  code: string
): string => createHmac('sha256', pepper).update(uid + ':' + phone + ':' + salt + ':' + code).digest('hex');

export const verifyEmergencyContactOtpHash = (candidate: string, expected: unknown): boolean => {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'));
};
