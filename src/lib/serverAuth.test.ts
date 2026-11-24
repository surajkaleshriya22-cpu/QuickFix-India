import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { extractBearerToken } from './serverAuth.ts';

test('extracts Firebase bearer tokens', () => {
  assert.equal(extractBearerToken('Bearer token-value'), 'token-value');
});
test('accepts case-insensitive scheme and repeated whitespace', () => {
  assert.equal(extractBearerToken('bEaReR   token-value'), 'token-value');
});
test('rejects missing, malformed, and non-Bearer headers', () => {
  for (const value of [undefined, '', 'Basic token', 'Bearer', 'Bearer token with spaces']) {
    assert.equal(extractBearerToken(value), null);
  }
});
