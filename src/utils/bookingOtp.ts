export interface BookingStartValidationInput {
  assignedPartnerUid: unknown;
  bookingStatus: unknown;
  storedOtp: unknown;
  submittedOtp: unknown;
  partnerUid: string;
}

export type BookingStartValidationResult =
  | { valid: true }
  | { valid: false; reason: 'NOT_ASSIGNED_PARTNER' | 'INVALID_START_STATUS' | 'INVALID_START_OTP' };

export function validateBookingStart(input: BookingStartValidationInput): BookingStartValidationResult {
  if (input.assignedPartnerUid !== input.partnerUid) {
    return { valid: false, reason: 'NOT_ASSIGNED_PARTNER' };
  }

  if (!['assigned', 'technician_en_route'].includes(String(input.bookingStatus || ''))) {
    return { valid: false, reason: 'INVALID_START_STATUS' };
  }

  if (!/^\d{6}$/.test(String(input.submittedOtp || '')) || input.storedOtp !== input.submittedOtp) {
    return { valid: false, reason: 'INVALID_START_OTP' };
  }

  return { valid: true };
}
