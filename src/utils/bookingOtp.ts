export const isStartOtpBookingStatus = (status: unknown): boolean =>
  status === 'assigned' || status === 'technician_en_route';

export const isStartOtpExpired = (expiresAt: unknown, nowMs = Date.now()): boolean => {
  const expiryMs = typeof expiresAt === 'string' ? Date.parse(expiresAt) : Number.NaN;
  return !Number.isFinite(expiryMs) || expiryMs <= nowMs;
};

export const isValidStartOtp = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{6}$/.test(value);
