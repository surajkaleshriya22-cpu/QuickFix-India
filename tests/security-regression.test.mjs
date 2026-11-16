import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

function routeDeclaration(method, route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp("app\\." + method + "\\('" + escaped + "'[^\\n]*");
  const match = server.match(pattern);
  assert.ok(match, `Expected ${method.toUpperCase()} ${route} route to exist`);
  return match[0];
}

function routeBlock(method, route) {
  const declaration = routeDeclaration(method, route);
  const start = server.indexOf(declaration);
  const nextRoute = server.indexOf("\napp.", start + declaration.length);
  return server.slice(start, nextRoute < 0 ? server.length : nextRoute);
}

test('admin wallet audit requires Firebase authentication and server admin claim', () => {
  const declaration = routeDeclaration('get', '/api/admin/wallet-audit');
  assert.match(declaration, /authenticateFirebaseUser/);
  assert.match(declaration, /requireServerAdmin/);
  assert.match(routeBlock('get', '/api/admin/wallet-audit'), /readOnly:\s*true/);
});

test('partner wallet is authenticated and never enables client top-ups or payouts', () => {
  const declaration = routeDeclaration('get', '/api/partners/wallet');
  assert.match(declaration, /authenticateFirebaseUser/);
  const block = routeBlock('get', '/api/partners/wallet');
  assert.match(block, /topupsEnabled:\s*false/);
  assert.match(block, /payoutEnabled:\s*false/);
});

test('booking accept, start and customer OTP routes require Firebase authentication', () => {
  for (const [method, route] of [
    ['post', '/api/bookings/:bookingId/accept'],
    ['post', '/api/bookings/:bookingId/start'],
    ['get', '/api/bookings/:bookingId/start-otp'],
  ]) {
    assert.match(routeDeclaration(method, route), /authenticateFirebaseUser/);
  }
});

test('job-start OTP is restricted to the booking customer and an unexpired eligible booking', () => {
  const block = routeBlock('get', '/api/bookings/:bookingId/start-otp');
  assert.match(block, /booking\.customerUid !== uid/);
  assert.match(block, /startOtpExpiresAt/);
  assert.match(block, /decryptBookingOtp/);
});

test('live-location read and write endpoints require Firebase authentication', () => {
  for (const [method, route] of [
    ['get', '/api/bookings/:bookingId/location/consent'],
    ['post', '/api/bookings/:bookingId/location/consent'],
    ['post', '/api/bookings/:bookingId/location'],
    ['get', '/api/bookings/:bookingId/location'],
  ]) {
    assert.match(routeDeclaration(method, route), /authenticateFirebaseUser/);
  }
});

test('OTP encryption key fails closed unless it is exactly 32 bytes of hex', () => {
  assert.match(server, /!\/\^\[a-fA-F0-9\]\{64\}\$\//);
  assert.match(server, /OTP_ENCRYPTION_KEY must be configured/);
});

test('payout confirmation webhook remains disabled until a verified provider flow exists', () => {
  const block = routeBlock('post', '/api/webhooks/payout-confirmation');
  assert.match(block, /status\(503\)/);
});

test('secure job completion requires the assigned verified partner and an in-progress booking', () => {
  const declaration = routeDeclaration('post', '/api/bookings/:bookingId/complete');
  assert.match(declaration, /authenticateFirebaseUser/);
  const block = routeBlock('post', '/api/bookings/:bookingId/complete');
  assert.match(block, /booking\.technicianUid !== uid/);
  assert.match(block, /booking\.assignedPartnerUid !== uid/);
  assert.match(block, /partner\.isVerified !== true/);
  assert.match(block, /partner\.accountStatus !== 'active'/);
  assert.match(block, /booking\.status !== 'in_progress'/);
  assert.match(block, /status: 'completed'/);
  assert.match(block, /liveLocations/);
  assert.match(block, /customerEnabled: false/);
  assert.match(block, /does not confirm customer payment or trigger any payout/);
});
