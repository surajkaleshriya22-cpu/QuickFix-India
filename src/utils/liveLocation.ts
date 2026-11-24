export type LiveLocationBooking = {
  status?: unknown;
  customerUid?: unknown;
  technicianUid?: unknown;
  assignedPartnerUid?: unknown;
};

export type LocationSharingConsent = {
  customerEnabled?: unknown;
  partnerEnabled?: unknown;
};

const ACTIVE_LOCATION_STATUSES = new Set(['assigned', 'technician_en_route', 'in_progress']);

export function isLiveLocationBookingStatus(status: unknown): boolean {
  return typeof status === 'string' && ACTIVE_LOCATION_STATUSES.has(status);
}

export function getBookingLocationParticipantRole(booking: LiveLocationBooking, uid: string): 'customer' | 'partner' | null {
  if (!uid) return null;
  if (booking.customerUid === uid) return 'customer';
  if (booking.technicianUid === uid || booking.assignedPartnerUid === uid) return 'partner';
  return null;
}

export function areBothLocationConsentsEnabled(sharing: LocationSharingConsent | null | undefined): boolean {
  return sharing?.customerEnabled === true && sharing?.partnerEnabled === true;
}
