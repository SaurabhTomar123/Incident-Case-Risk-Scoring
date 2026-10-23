const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

test('API: add alerts, apply policy, remove alert, summary stays correct', async (t) => {
  const server = createApp(openDb(':memory:')).listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  const alerts = (await call('GET', '/alerts')).body;
  assert.ok(alerts.length >= 8);

  // Seeded ids 3 (38) + 4 (32) = 70
  await call('POST', '/case/alerts', { alertId: 3 });
  let c = (await call('POST', '/case/alerts', { alertId: 4 })).body;
  assert.equal(c.summary.raw, 70);

  c = (await call('PUT', '/case/policies', { policies: 'APT_CAMPAIGN_LINK' })).body;
  assert.equal(c.summary.final, 95);

  // Removing an alert drops the score below 50: APT must stop applying.
  c = (await call('DELETE', '/case/alerts/4')).body;
  assert.equal(c.summary.final, 38);
  assert.deepEqual(c.policies, ['APT_CAMPAIGN_LINK']);

  assert.equal((await call('PUT', '/case/policies', { policies: 'CRITICAL_ASSET_BOOST APT_CAMPAIGN_LINK' })).status, 400);
  assert.equal((await call('POST', '/case/alerts', { alertId: 999 })).status, 404);
});

test('API: rejects malformed input instead of coercing it', async (t) => {
  const server = createApp(openDb(':memory:')).listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api`;
  const status = async (method, path, body) =>
    (await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body })).status;

  for (const alertId of [true, '1', 1.5, -1, 0, null]) {
    assert.equal(await status('POST', '/case/alerts', JSON.stringify({ alertId })), 400, `alertId=${alertId}`);
  }
  assert.equal(await status('DELETE', '/case/alerts/abc'), 400);
  assert.equal(await status('PUT', '/case/policies', JSON.stringify({})), 400);
  assert.equal(await status('PUT', '/case/policies', '{bad json'), 400);
});
