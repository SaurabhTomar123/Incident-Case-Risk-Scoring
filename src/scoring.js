// Pure scoring engine: no DB, no HTTP. Easy to unit test and reason about.

const POLICIES = ['REPEAT_NOISE_DAMPING', 'CRITICAL_ASSET_BOOST', 'APT_CAMPAIGN_LINK'];
const ESCALATIONS = ['CRITICAL_ASSET_BOOST', 'APT_CAMPAIGN_LINK'];

const MAX_SCORE = 100;
const BOOST_RATE = 0.2;
const BOOST_CAP = 30;
const APT_POINTS = 25;
const APT_MIN_SCORE = 50;

// Turns user input like "repeat_noise_damping, CRITICAL_ASSET_BOOST" into a validated list.
// Throws on unknown names or when both escalation policies are requested.
function parsePolicies(input) {
  const names = [...new Set(String(input ?? '').toUpperCase().split(/[\s,]+/).filter(Boolean))];
  const unknown = names.filter((n) => !POLICIES.includes(n));
  if (unknown.length) throw new Error(`Unknown policy: ${unknown.join(', ')}`);
  if (names.filter((n) => ESCALATIONS.includes(n)).length > 1) {
    throw new Error('Only one escalation policy (CRITICAL_ASSET_BOOST or APT_CAMPAIGN_LINK) can be active');
  }
  // Return in canonical evaluation order so stored values are stable.
  return POLICIES.filter((p) => names.includes(p));
}

function severity(score) {
  if (score >= 85) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

// alerts: [{ category, base_score }], policies: validated list from parsePolicies.
// Order: raw -> noise damping -> one escalation -> cap at 100 -> severity band.
function scoreCase(alerts, policies = []) {
  const raw = alerts.reduce((sum, a) => sum + a.base_score, 0);
  const adjustments = [];
  let score = raw;

  if (policies.includes('REPEAT_NOISE_DAMPING')) {
    const scans = alerts.filter((a) => a.category === 'network_scan').map((a) => a.base_score);
    const ignored = scans.length > 1 ? scans.reduce((s, x) => s + x, 0) - Math.max(...scans) : 0;
    score -= ignored;
    adjustments.push({
      policy: 'REPEAT_NOISE_DAMPING',
      applied: ignored > 0,
      points: -ignored,
      note: ignored > 0 ? `Ignored ${scans.length - 1} extra network_scan alert(s)` : 'Fewer than 2 network_scan alerts; nothing to damp',
    });
  }

  if (policies.includes('CRITICAL_ASSET_BOOST')) {
    const boost = Math.min(Math.floor(score * BOOST_RATE), BOOST_CAP);
    score += boost;
    adjustments.push({ policy: 'CRITICAL_ASSET_BOOST', applied: true, points: boost, note: `20% of ${score - boost}, max ${BOOST_CAP}` });
  }

  if (policies.includes('APT_CAMPAIGN_LINK')) {
    // Re-evaluated on every read, so if alerts are removed the link silently stops applying.
    const ok = score >= APT_MIN_SCORE;
    if (ok) score += APT_POINTS;
    adjustments.push({
      policy: 'APT_CAMPAIGN_LINK',
      applied: ok,
      points: ok ? APT_POINTS : 0,
      note: ok ? `Score ${score - APT_POINTS} >= ${APT_MIN_SCORE}` : `Not applied: score ${score} is below ${APT_MIN_SCORE}`,
    });
  }

  if (score > MAX_SCORE) {
    adjustments.push({ policy: 'CAP', applied: true, points: MAX_SCORE - score, note: `Capped at ${MAX_SCORE}` });
    score = MAX_SCORE;
  }

  return { raw, adjustments, final: score, severity: severity(score) };
}

module.exports = { POLICIES, parsePolicies, scoreCase, severity };
