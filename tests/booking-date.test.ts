import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidBookingDate } from '../src/utils/bookingDate.ts';

test('rejects impossible calendar dates', () => {
  assert.equal(isValidBookingDate('2026-02-30', new Date('2026-01-01T00:00:00Z')), false);
  assert.equal(isValidBookingDate('2026-13-01', new Date('2026-01-01T00:00:00Z')), false);
  assert.equal(isValidBookingDate('2026-00-10', new Date('2026-01-01T00:00:00Z')), false);
});

test('accepts leap day only in leap years', () => {
  assert.equal(isValidBookingDate('2024-02-29', new Date('2024-01-01T00:00:00Z')), true);
  assert.equal(isValidBookingDate('2025-02-29', new Date('2025-01-01T00:00:00Z')), false);
});

test('rejects malformed date strings', () => {
  for (const value of ['2026-2-01', '26-02-01', '2026/02/01', '', null, 20260201]) {
    assert.equal(isValidBookingDate(value, new Date('2026-01-01T00:00:00Z')), false);
  }
});

test('compares against the India-local calendar day', () => {
  // 2026-01-01 20:00 UTC is already 2026-01-02 in India.
  const now = new Date('2026-01-01T20:00:00Z');
  assert.equal(isValidBookingDate('2026-01-01', now), false);
  assert.equal(isValidBookingDate('2026-01-02', now), true);
  assert.equal(isValidBookingDate('2026-01-03', now), true);
});
