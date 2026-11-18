import test from 'node:test';
import assert from 'node:assert/strict';
import { INDORE_MARKET_BENCHMARKS, INDORE_BENCHMARKS_ARE_PUBLISHABLE } from '../src/data/indoreRateResearch';

test('Indore research benchmarks are explicitly not publishable', () => {
  assert.equal(INDORE_BENCHMARKS_ARE_PUBLISHABLE, false);
  assert.ok(INDORE_MARKET_BENCHMARKS.length >= 5);
});

test('every research benchmark has a source and a valid range', () => {
  for (const benchmark of INDORE_MARKET_BENCHMARKS) {
    assert.ok(benchmark.sourceUrl.startsWith('https://'));
    assert.ok(benchmark.sourceName.length > 0);
    assert.ok(benchmark.minimumInr > 0);
    assert.ok(benchmark.maximumInr >= benchmark.minimumInr);
    assert.equal(benchmark.checkedOn, '2026-11-18');
  }
});
