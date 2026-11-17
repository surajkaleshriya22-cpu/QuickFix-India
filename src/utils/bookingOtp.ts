export interface BookingStartValidationInput {
  assignedPartnerUid: unknown;
  bookingStatus: unknown;
  storedOtp: unknown;
  submittedOtp: unknown;
  partnerUid: string;
  bookingCustomerUid?: unknown;
  privateCustomerUid?: unknown;
  privatePartnerUid?: unknown;
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

  if (
    input.bookingCustomerUid !== undefined &&
    (!input.bookingCustomerUid ||
      input.privateCustomerUid !== input.bookingCustomerUid ||
      input.privatePartnerUid !== input.partnerUid)
  ) {
    return { valid: false, reason: 'INVALID_START_OTP' };
  }

  if (!/^\d{6}$/.test(String(input.submittedOtp || '')) || input.storedOtp !== input.submittedOtp) {
    return { valid: false, reason: 'INVALID_START_OTP' };
  }

  return { valid: true };
}

export function getCustomerVisibleStartOtp(input: {
  bookingCustomerUid: unknown;
  bookingPartnerUid: unknown;
  bookingStatus: unknown;
  privateCustomerUid: unknown;
  privatePartnerUid: unknown;
  storedOtp: unknown;
  customerUid: string;
}): string {
  const activeAssignment = ['assigned', 'technician_en_route'].includes(String(input.bookingStatus || ''));
  const ownershipMatches =
    input.bookingCustomerUid === input.customerUid &&
    input.privateCustomerUid === input.customerUid &&
    Boolean(input.bookingPartnerUid) &&
    input.privatePartnerUid === input.bookingPartnerUid;
  const otp = typeof input.storedOtp === 'string' ? input.storedOtp : '';
  return activeAssignment && ownershipMatches && /^\d{6}$/.test(otp) ? otp : '';
}
