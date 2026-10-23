const path = require('node:path');
const express = require('express');
const { parsePolicies, scoreCase } = require('./scoring');

const CASE_ID = 1; // single working case; schema already supports more

// Returns a positive integer id or null. No loose coercion (true -> 1, "1.5" -> 1.5, etc.).
const parseId = (n) => (Number.isInteger(n) && n > 0 ? n : null);
// URL params are always strings, so only digit-only strings are converted.
const parseIdParam = (s) => parseId(/^\d+$/.test(s) ? Number(s) : null);

function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const q = {
    alerts: db.prepare('SELECT * FROM alerts ORDER BY id'),
    alert: db.prepare('SELECT id FROM alerts WHERE id = ?'),
    caseAlerts: db.prepare(`SELECT a.* FROM alerts a JOIN case_alerts ca ON ca.alert_id = a.id
                            WHERE ca.case_id = ? ORDER BY a.id`),
    policies: db.prepare('SELECT policies FROM cases WHERE id = ?'),
    addAlert: db.prepare('INSERT OR IGNORE INTO case_alerts (case_id, alert_id) VALUES (?, ?)'),
    removeAlert: db.prepare('DELETE FROM case_alerts WHERE case_id = ? AND alert_id = ?'),
    setPolicies: db.prepare('UPDATE cases SET policies = ? WHERE id = ?'),
  };

  // The summary is always computed from current state, never stored, so it can't go stale.
  function caseView() {
    const alerts = q.caseAlerts.all(CASE_ID);
    const policies = q.policies.get(CASE_ID).policies.split(',').filter(Boolean);
    return { alerts, policies, summary: scoreCase(alerts, policies) };
  }

  app.get('/api/alerts', (req, res) => res.json(q.alerts.all()));

  app.get('/api/case', (req, res) => res.json(caseView()));

  app.post('/api/case/alerts', (req, res) => {
    const id = parseId(req.body?.alertId);
    if (!id) return res.status(400).json({ error: 'alertId must be a positive integer' });
    if (!q.alert.get(id)) return res.status(404).json({ error: 'Alert not found' });
    q.addAlert.run(CASE_ID, id);
    res.json(caseView());
  });

  app.delete('/api/case/alerts/:alertId', (req, res) => {
    const id = parseIdParam(req.params.alertId);
    if (!id) return res.status(400).json({ error: 'alertId must be a positive integer' });
    q.removeAlert.run(CASE_ID, id); // idempotent: removing an alert not in the case is a no-op
    res.json(caseView());
  });

  app.put('/api/case/policies', (req, res) => {
    // Require the field explicitly so a malformed request can't silently clear policies.
    if (typeof req.body?.policies !== 'string') {
      return res.status(400).json({ error: 'policies must be a string (use "" to clear)' });
    }
    try {
      q.setPolicies.run(parsePolicies(req.body?.policies).join(','), CASE_ID);
      res.json(caseView());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // JSON errors everywhere (e.g. malformed request body), without leaking internals on 500s.
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
