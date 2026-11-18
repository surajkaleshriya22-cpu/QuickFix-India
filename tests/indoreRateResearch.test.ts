import test from 'node:test';
import assert from 'node:assert/strict';
import { INDORE_MARKET_BENCHMARKS, INDORE_BENCHMARKS_ARE_PUBLISHABLE } from '../src/data/indoreRateResearch';

test('Indore research benchmarks are explicitly not publishable', () => {
  assert.equal(INDORE_BENCHMARKS_ARE_PUBLISHABLE, false);
  assert.ok(INDORE_MARKET_BENCHMARKS.length >= 25);
});

test('every research benchmark has a source and a valid range', () => {
  const ids = new Set<string>();
  for (const benchmark of INDORE_MARKET_BENCHMARKS) {
    assert.ok(!ids.has(benchmark.id), `duplicate benchmark id: ${benchmark.id}`);
    ids.add(benchmark.id);
    assert.ok(benchmark.sourceUrl.startsWith('https://'));
    assert.ok(benchmark.sourceName.length > 0);
    assert.ok(benchmark.minimumInr > 0);
    assert.ok(benchmark.maximumInr >= benchmark.minimumInr);
    assert.equal(benchmark.checkedOn, '2026-11-18');
    assert.ok(benchmark.caveat.length > 20);
  }
});

test('city-wide research includes the major QuickFix service families', () => {
  const categories = new Set(INDORE_MARKET_BENCHMARKS.map(item => item.category));
  for (const category of [
    'electrician', 'plumber', 'painter', 'ac_repair', 'technician',
    'kaamkaaj_partner', 'mechanic', 'driver', 'pest_control', 'carpenter'
  ]) {
    assert.ok(categories.has(category), `missing category: ${category}`);
  }
});

import { INDORE_MARKET_AREAS } from '../src/data/indoreMarketAreas';

test('Indore market coverage includes multiple city localities without claiming local quote verification', () => {
  assert.ok(INDORE_MARKET_AREAS.length >= 15);
  assert.ok(INDORE_MARKET_AREAS.some(area => area.locality === 'Vijay Nagar'));
  assert.ok(INDORE_MARKET_AREAS.some(area => area.locality === 'Rau'));
  assert.ok(INDORE_MARKET_AREAS.every(area => area.localitySpecificQuotesVerified === false));
  assert.ok(INDORE_MARKET_AREAS.every(area => area.sourceUrls.length > 0));
});
