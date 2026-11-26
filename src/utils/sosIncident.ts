export const SOS_INCIDENT_TYPES = ['safety_concern', 'medical_emergency', 'harassment', 'other'] as const;

export type SosIncidentType = typeof SOS_INCIDENT_TYPES[number];

export function isValidSosIncidentInput(
  bookingId: unknown,
  requestId: unknown,
  incidentType: unknown,
  message: unknown
): boolean {
  return typeof bookingId === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(bookingId) &&
    typeof requestId === 'string' && /^[A-Za-z0-9_-]{12,100}$/.test(requestId) &&
    typeof incidentType === 'string' && SOS_INCIDENT_TYPES.includes(incidentType as SosIncidentType) &&
    (message === undefined || (typeof message === 'string' && message.trim().length <= 500));
}

export function isActiveSosBookingStatus(status: unknown): boolean {
  return typeof status === 'string' && ['assigned', 'technician_en_route', 'in_progress'].includes(status);
}

export function getSosReporterRole(booking: { customerUid?: unknown; technicianUid?: unknown }, uid: string): 'CUSTOMER' | 'CHANNEL_PARTNER' | null {
  if (booking.customerUid === uid) return 'CUSTOMER';
  if (booking.technicianUid === uid) return 'CHANNEL_PARTNER';
  return null;
}
