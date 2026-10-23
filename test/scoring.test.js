const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePolicies, scoreCase, severity } = require('../src/scoring');

const a = (base_score, category = 'malware') => ({ base_score, category });

test('raw score is the sum of base scores, no policies', () => {
  const s = scoreCase([a(10), a(20)]);
  assert.equal(s.raw, 30);
  assert.equal(s.final, 30);
  assert.deepEqual(s.adjustments, []);
});

test('empty case scores 0 / Low', () => {
  assert.deepEqual(scoreCase([], ['CRITICAL_ASSET_BOOST']).final, 0);
});

test('severity band boundaries', () => {
  assert.deepEqual([0, 29, 30, 59, 60, 84, 85, 100].map(severity),
    ['Low', 'Low', 'Medium', 'Medium', 'High', 'High', 'Critical', 'Critical']);
});

test('REPEAT_NOISE_DAMPING keeps only the highest network_scan alert', () => {
  const s = scoreCase([a(8, 'network_scan'), a(12, 'network_scan'), a(6, 'network_scan'), a(20)], ['REPEAT_NOISE_DAMPING']);
  assert.equal(s.raw, 46);
  assert.equal(s.final, 32); // 12 + 20
  assert.equal(s.adjustments[0].points, -14);
});

test('REPEAT_NOISE_DAMPING with a single scan changes nothing', () => {
  const s = scoreCase([a(8, 'network_scan'), a(20)], ['REPEAT_NOISE_DAMPING']);
  assert.equal(s.final, 28);
  assert.equal(s.adjustments[0].applied, false);
});

test('CRITICAL_ASSET_BOOST adds 20%, rounded down', () => {
  assert.equal(scoreCase([a(37)], ['CRITICAL_ASSET_BOOST']).final, 44); // floor(7.4) = 7
});

test('CRITICAL_ASSET_BOOST is capped at 30 points', () => {
  const s = scoreCase([a(40), a(40), a(40), a(40)], ['CRITICAL_ASSET_BOOST']); // 160 -> boost 32 -> 30
  assert.equal(s.adjustments[0].points, 30);
  assert.equal(s.final, 100);
});

test('APT_CAMPAIGN_LINK applies at exactly 50', () => {
  assert.equal(scoreCase([a(25), a(25)], ['APT_CAMPAIGN_LINK']).final, 75);
});

test('APT_CAMPAIGN_LINK does not apply below 50 (e.g. after an alert is removed)', () => {
  const s = scoreCase([a(25), a(24)], ['APT_CAMPAIGN_LINK']);
  assert.equal(s.final, 49);
  assert.equal(s.adjustments[0].applied, false);
});

test('damping runs before the APT threshold check', () => {
  // raw 56 qualifies, but after damping the score is 46 (16 + 30), so APT must not apply
  const s = scoreCase([a(16, 'network_scan'), a(10, 'network_scan'), a(30)], ['REPEAT_NOISE_DAMPING', 'APT_CAMPAIGN_LINK']);
  assert.equal(s.final, 46);
  assert.equal(s.adjustments[1].applied, false);
});

test('final score is capped at 100', () => {
  const s = scoreCase([a(40), a(40), a(30)], ['APT_CAMPAIGN_LINK']); // 110 + 25
  assert.equal(s.final, 100);
  assert.equal(s.severity, 'Critical');
  assert.equal(s.adjustments.at(-1).policy, 'CAP');
});

test('parsePolicies normalises, dedupes and orders input', () => {
  assert.deepEqual(parsePolicies(' critical_asset_boost,REPEAT_NOISE_DAMPING repeat_noise_damping '),
    ['REPEAT_NOISE_DAMPING', 'CRITICAL_ASSET_BOOST']);
  assert.deepEqual(parsePolicies(''), []);
});

test('parsePolicies rejects unknown and conflicting policies', () => {
  assert.throws(() => parsePolicies('FOO'), /Unknown policy/);
  assert.throws(() => parsePolicies('CRITICAL_ASSET_BOOST, APT_CAMPAIGN_LINK'), /Only one escalation/);
});
