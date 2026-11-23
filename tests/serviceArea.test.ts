import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPartnerServiceArea, serviceAreaKey } from '../src/utils/serviceArea';

const partnerArea = { state: 'Madhya Pradesh', district: 'Bhopal', tehsil: 'Huzur' };

test('matches a different city within the same Indian district', () => {
  assert.equal(matchesPartnerServiceArea(
    partnerArea,
    { state: 'Madhya Pradesh', district: 'Bhopal', tehsil: 'Berasia' },
    'Bhopal',
    'Berasia'
  ), true);
});

test('does not match a different district even when city labels are equal', () => {
  assert.equal(matchesPartnerServiceArea(
    partnerArea,
    { state: 'Madhya Pradesh', district: 'Indore', tehsil: 'Indore' },
    'Same City Label',
    'Same City Label'
  ), false);
});

test('matches administrative areas without case or whitespace sensitivity', () => {
  assert.equal(matchesPartnerServiceArea(
    { state: ' madhya pradesh ', district: 'BHOPAL' },
    { state: 'MADHYA PRADESH', district: 'Bhopal' },
    'Bhopal',
    'Bhopal'
  ), true);
});

test('uses exact city matching for legacy records without district data', () => {
  assert.equal(matchesPartnerServiceArea(
    null,
    null,
    'Indore',
    'indore'
  ), true);
  assert.equal(matchesPartnerServiceArea(
    null,
    { state: 'Madhya Pradesh', district: 'Bhopal' },
    'Indore',
    'Bhopal'
  ), false);
});

test('fails closed when neither structured area nor city is available', () => {
  assert.equal(matchesPartnerServiceArea(null, null, '', 'Bhopal'), false);
});

test('creates stable Firestore keys for case and whitespace variants', () => {
  assert.equal(serviceAreaKey(' Madhya Pradesh '), 'madhya pradesh');
  assert.equal(serviceAreaKey('BHOPAL'), serviceAreaKey('Bhopal'));
});
