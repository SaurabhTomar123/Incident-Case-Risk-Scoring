const path = require('node:path');
const express = require('express');
const { parsePolicies, scoreCase } = require('./scoring');

const CASE_ID = 1; // single working case; schema already supports more

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
    const id = Number(req.body?.alertId);
    if (!q.alert.get(id)) return res.status(404).json({ error: 'Alert not found' });
    q.addAlert.run(CASE_ID, id);
    res.json(caseView());
  });

  app.delete('/api/case/alerts/:alertId', (req, res) => {
    q.removeAlert.run(CASE_ID, Number(req.params.alertId));
    res.json(caseView());
  });

  app.put('/api/case/policies', (req, res) => {
    try {
      q.setPolicies.run(parsePolicies(req.body?.policies).join(','), CASE_ID);
      res.json(caseView());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return app;
}

module.exports = { createApp };
