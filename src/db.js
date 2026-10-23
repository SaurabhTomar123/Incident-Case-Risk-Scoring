// SQLite via Node's built-in driver (node:sqlite) - no native build step needed.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SEED_ALERTS = [
  ['Phishing email with credential lure', 'phishing', 'mail-gw-01', 18],
  ['Malicious attachment opened', 'phishing', 'wks-finance-07', 27],
  ['Ransomware binary detected', 'malware', 'srv-db-02', 38],
  ['Trojan beaconing to C2 domain', 'malware', 'wks-hr-03', 32],
  ['Inbound port scan from external IP', 'network_scan', 'fw-edge-01', 8],
  ['Internal SMB sweep', 'network_scan', 'wks-dev-11', 12],
  ['Repeated SYN scan on DMZ', 'network_scan', 'fw-edge-01', 6],
  ['Brute-force login attempts', 'credential_access', 'vpn-gw-01', 22],
  ['LSASS memory dump attempt', 'credential_access', 'srv-dc-01', 35],
];

function openDb(file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY,
      title       TEXT NOT NULL,
      category    TEXT NOT NULL,
      source_host TEXT NOT NULL,
      base_score  INTEGER NOT NULL CHECK (base_score BETWEEN 1 AND 40)
    );
    CREATE TABLE IF NOT EXISTS cases (
      id       INTEGER PRIMARY KEY,
      policies TEXT NOT NULL DEFAULT ''   -- comma-separated, validated before write
    );
    CREATE TABLE IF NOT EXISTS case_alerts (
      case_id  INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      alert_id INTEGER NOT NULL REFERENCES alerts(id),
      PRIMARY KEY (case_id, alert_id)      -- an alert can be in a case only once
    );
    INSERT OR IGNORE INTO cases (id) VALUES (1);
  `);

  // Idempotent seed: only when the table is empty.
  if (db.prepare('SELECT COUNT(*) AS n FROM alerts').get().n === 0) {
    const insert = db.prepare('INSERT INTO alerts (title, category, source_host, base_score) VALUES (?, ?, ?, ?)');
    for (const row of SEED_ALERTS) insert.run(...row);
  }
  return db;
}

module.exports = { openDb };
