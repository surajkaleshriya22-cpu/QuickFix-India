import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuickFixId } from '../src/utils/quickFixId.ts';

test('normalizes valid partner IDs without changing their identity', () => {
  assert.equal(normalizeQuickFixId('  qfp-12345678  ', 'PARTNER'), 'QFP-12345678');
});

test('rejects malformed, wrong-role, and non-string partner IDs', () => {
  for (const value of [null, undefined, 123, '', 'QFC-12345678', 'QFP-1234567', 'QFP-123456789', 'QFP-ABCDEFGH', '../QFP-12345678']) {
    assert.equal(normalizeQuickFixId(value, 'PARTNER'), null);
  }
});

test('normalizes customer IDs only for the customer namespace', () => {
  assert.equal(normalizeQuickFixId('qfc-87654321', 'CUSTOMER'), 'QFC-87654321');
  assert.equal(normalizeQuickFixId('QFP-87654321', 'CUSTOMER'), null);
});
