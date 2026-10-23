# Incident Case Risk Scoring

A small full-stack tool for SOC analysts: pick security alerts, group them into a case, apply scoring policies and get a single risk score with a severity band.

## Tech stack

| Layer    | Choice | Why |
|----------|--------|-----|
| Backend  | Node.js 24 + Express 5 | Small, readable HTTP layer |
| Database | SQLite via built-in `node:sqlite` | Zero setup, no native build step, file-based persistence |
| Frontend | Single `index.html`, vanilla JS | The UI can be plain; no build tooling needed |
| Tests    | `node:test` (built in) | No extra test dependencies |

Express is the only runtime dependency.

## Architecture

```
public/index.html   UI: alert list, case view, policy box, score summary
src/server.js       entry point (reads PORT, DB_PATH)
src/app.js          REST routes; builds the case view
src/db.js           schema + idempotent seed
src/scoring.js      pure scoring engine (no I/O)
test/               unit tests for scoring + one API flow test
```

**Design decisions**

- **Scoring is a pure function** (`scoreCase(alerts, policies)`). All business rules live in one file that can be tested without a DB or server.
- **The score is never stored.** Only the case alerts and the selected policies are persisted; the summary is recomputed on every request. If the case changes so that a policy no longer qualifies (e.g. APT drops below 50), the summary is still correct because nothing stale exists.
- **Policies are validated on write.** Unknown names or both escalation policies together give a `400` and nothing is saved. Input is case-insensitive and can be comma or space separated.
- **A policy that is selected but does not qualify** stays on the case and shows in the summary as "not applied", with the reason. It applies again automatically if the case qualifies later.
- **Duplicate alerts are blocked** by the `(case_id, alert_id)` primary key, so one alert cannot be counted twice.
- **Single working case** (`id = 1`). The schema already has a `cases` table, so supporting multiple cases is just routes plus UI.

## Business rules and order of evaluation

```
raw      = sum(base_score of alerts in the case)
score    = raw
1. REPEAT_NOISE_DAMPING  -> keep only the highest network_scan alert; subtract the rest
2. CRITICAL_ASSET_BOOST  -> + min(floor(score * 20%), 30)
   or APT_CAMPAIGN_LINK  -> + 25, only if score >= 50 at this point
3. Cap                   -> final = min(score, 100)
4. Band                  -> 0-29 Low, 30-59 Medium, 60-84 High, 85-100 Critical
```

Why this order:
- Damping runs first because it fixes the input (noise). The APT threshold ("at least 50 before the boost") and the 20% boost are both measured on the damped score. Otherwise repeated port scans could unlock an escalation by themselves.
- The cap at 100 runs last, so every adjustment is visible in the breakdown before clipping. The cap appears as its own `CAP` line.
- Only the 20% boost can produce fractions. It is rounded down (`Math.floor`) before the 30-point cap is applied.

## Run locally

Requires Node.js >= 22.13 (built and tested on 24).

```bash
npm install
npm start            # http://localhost:3000
```

The database file is created and seeded on first start at `./data/app.db`. To reset it, delete that file.

## Tests

```bash
npm test
```

The tests cover every rule, the band boundaries, rounding, both caps, damping before the APT check, conflicting or unknown policies, and an API flow where removing an alert disqualifies APT.

## API

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET    | `/api/alerts` | - | all alerts |
| GET    | `/api/case` | - | case view |
| POST   | `/api/case/alerts` | `{ "alertId": 3 }` | case view (404 if unknown alert; adding twice is a no-op) |
| DELETE | `/api/case/alerts/:alertId` | - | case view |
| PUT    | `/api/case/policies` | `{ "policies": "REPEAT_NOISE_DAMPING, APT_CAMPAIGN_LINK" }` | case view, or 400 with `{ error }` |

Case view:

```json
{
  "alerts": [{ "id": 3, "title": "...", "category": "malware", "source_host": "srv-db-02", "base_score": 38 }],
  "policies": ["APT_CAMPAIGN_LINK"],
  "summary": {
    "raw": 38,
    "adjustments": [{ "policy": "APT_CAMPAIGN_LINK", "applied": false, "points": 0, "note": "Not applied: score 38 is below 50" }],
    "final": 38,
    "severity": "Medium"
  }
}
```

Send an empty `policies` string to clear all policies.

## Deployment

### Docker

```bash
docker build -t case-risk-scoring .
docker run -d -p 3000:3000 -v case-data:/app/data case-risk-scoring
```

The named volume keeps the SQLite file between container restarts.

### Any Node host (Render, Railway, a VM, ...)

1. Set the build command to `npm ci --omit=dev` and the start command to `npm start`.
2. Attach a persistent disk and point `DB_PATH` at it. Without one, the case resets on redeploy.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/app.db` | SQLite file location |

### Database migration and seeding

There is no separate migration step. On startup the app runs `CREATE TABLE IF NOT EXISTS` and seeds the 9 alerts only if the `alerts` table is empty, so restarts are safe.

## Seed data

9 alerts in 4 categories: phishing (2), malware (2), network_scan (3), credential_access (2). Base scores range from 6 to 38. There are three network scans so the damping rule has something to do.

## Assumptions

- **Domain:** REPEAT_NOISE_DAMPING only treats `network_scan` as noise, as the spec says. Other repeated categories count in full.
- **Domain:** both escalation policies represent analyst judgement about context (critical asset, known campaign), so the analyst picks them per case and the system does not infer them from alert data.
- **"Score before the boost"** means the score after damping and before any escalation.
- **Security:** there is no auth (out of scope). All SQL uses prepared statements. The UI escapes server data before rendering it. Policy input is checked against an allow-list.

## Known limitations

- One shared case and no users, so concurrent analysts would edit the same case.
- `node:sqlite` is still marked experimental in Node and prints a warning at startup.
- There is no pagination or filtering on the alert list.

## With more time

- Multiple cases with an owner and status (open / investigating / closed).
- An audit trail of policy changes per case.
- Choose the critical-asset boost automatically from an asset inventory, using the host criticality of each alert.
- Optional damping for other repeated categories, plus configurable thresholds (stored in the DB instead of constants).
- A frontend component test and CI (GitHub Actions running `npm test`).
