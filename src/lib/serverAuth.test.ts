import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { extractBearerToken } from './serverAuth.ts';

test('extracts a Firebase bearer token', () => {
  assert.equal(extractBearerToken('Bearer eyJhbGciOi.example.signature'), 'eyJhbGciOi.example.signature');
});

test('accepts a case-insensitive scheme and repeated whitespace', () => {
  assert.equal(extractBearerToken('bEaReR   token-value'), 'token-value');
});

test('rejects missing, malformed, or non-Bearer authorization headers', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(''), null);
  assert.equal(extractBearerToken('Basic token-value'), null);
  assert.equal(extractBearerToken('Bearer'), null);
  assert.equal(extractBearerToken('Bearer token value'), null);
});
