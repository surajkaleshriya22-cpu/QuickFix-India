/** True when a paid record is presented with a different payment ID. */
export function isConflictingPaidPayment(
  paymentStatus: unknown,
  storedPaymentId: unknown,
  incomingPaymentId: unknown
): boolean {
  return paymentStatus === 'paid' &&
    (typeof storedPaymentId !== 'string' || storedPaymentId.length === 0 || storedPaymentId !== incomingPaymentId);
}
