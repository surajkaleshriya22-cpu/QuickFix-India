import test from 'node:test';
import assert from 'node:assert/strict';
import { isConflictingPaidPayment } from '../src/utils/paymentVerificationPolicy';

test('allows an idempotent retry with the same captured payment ID', () => {
  assert.equal(isConflictingPaidPayment('paid', 'pay_123', 'pay_123'), false);
});

test('rejects a different payment ID for an already-paid record', () => {
  assert.equal(isConflictingPaidPayment('paid', 'pay_123', 'pay_456'), true);
});

test('rejects a paid legacy record without a stored payment ID', () => {
  assert.equal(isConflictingPaidPayment('paid', undefined, 'pay_456'), true);
  assert.equal(isConflictingPaidPayment('paid', '', 'pay_456'), true);
});

test('does not classify a pending record as a payment conflict', () => {
  assert.equal(isConflictingPaidPayment('pending', undefined, 'pay_456'), false);
  assert.equal(isConflictingPaidPayment('failed', 'pay_123', 'pay_456'), false);
});
