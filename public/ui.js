const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const categoryNames = {phishing:'Phishing', malware:'Malware', network_scan:'Network scan', credential_access:'Credential access'};
const policyNames = {REPEAT_NOISE_DAMPING:'Noise damping', CRITICAL_ASSET_BOOST:'Critical asset boost', APT_CAMPAIGN_LINK:'APT campaign link', CAP:'Score cap'};
const icon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const folderIcon = icon('<path d="M3 7h7l2 2h9v11H3Z"/><path d="M3 7V4h7l2 3"/>');
let allAlerts = [], caseIds = new Set(), busy = false, ready = false;
async function api(method, url, body) {
  const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}). Please try again.`);
  return data;
}
async function run(action) {
  if (busy) return;
  busy = true;
  $('error').hidden = true;
  updateButtons();
  try {await action();}
  catch(err) { $('error').textContent = `${err.message} Check your connection and try again.`; $('error').hidden = false; }
  finally {busy = false; updateButtons();}
}
function updateButtons() {
  document.querySelectorAll('[data-add]').forEach(button => {button.disabled = busy || caseIds.has(Number(button.dataset.add));});
  document.querySelectorAll('[data-remove]').forEach(button => {button.disabled = busy;});
  $('apply').disabled = busy || !ready;
}
function renderAlerts() {
  const search = $('search').value.toLowerCase().trim(), category = $('category').value;
  const filtered = allAlerts.filter(a => (!category || a.category === category) && `${a.title} ${a.source_host} ${a.category}`.toLowerCase().includes(search));
  $('available-count').textContent = allAlerts.length;
  $('filter-count').textContent = `${filtered.length} of ${allAlerts.length} alerts`;
  $('alerts').innerHTML = filtered.map(a => `<tr><td><span class="alert-title">${esc(a.title)}</span><span class="host">${esc(a.source_host)}</span></td><td><span class="badge ${esc(a.category)}">${esc(categoryNames[a.category] || a.category)}</span></td><td class="numeric base-score">${a.base_score}</td><td><button class="add-btn" data-add="${a.id}" aria-label="${esc(caseIds.has(a.id) ? 'Already in case: ' : 'Add to case: ')}${esc(a.title)}" ${caseIds.has(a.id) || busy ? 'disabled' : ''}>${caseIds.has(a.id) ? 'Added' : '+ Add'}</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty-state"><strong>No matching alerts</strong>Try a different search or category.</td></tr>';
}
function renderCase({alerts, policies, summary}) {
  ready = true;
  caseIds = new Set(alerts.map(a => a.id));
  $('case-count').textContent = alerts.length;
  $('save-status').textContent = 'Saved';
  $('connection').textContent = 'Connected';
  $('connection').classList.add('connected');
  $('case').innerHTML = alerts.map(a => `<div class="case-item"><span class="case-icon">${folderIcon}</span><div class="item-text"><span class="alert-title">${esc(a.title)}</span><span class="host">${esc(a.source_host)} · ${esc(categoryNames[a.category] || a.category)}</span></div><span class="item-score">${a.base_score}</span><button class="remove-btn" data-remove="${a.id}" aria-label="Remove ${esc(a.title)}">${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button></div>`).join('') || `<div class="empty-state">${folderIcon}<strong>Your investigation starts here</strong>Add alerts from the library to build and score this case.</div>`;
  $('policy').value = policies.join(', ');
  $('damping').checked = policies.includes('REPEAT_NOISE_DAMPING');
  const escalation = policies.find(p => p === 'CRITICAL_ASSET_BOOST' || p === 'APT_CAMPAIGN_LINK') || '';
  document.querySelectorAll('[name="escalation"]').forEach(input => {input.checked = input.value === escalation;});
  $('final-score').textContent = summary.final;
  $('severity').textContent = summary.severity;
  $('severity').className = `severity ${summary.severity.toLowerCase()}`;
  $('score-fill').style.width = `${summary.final}%`;
  $('score-fill').style.backgroundColor = ({Low:'#347a52', Medium:'#b08727', High:'#c36a30', Critical:'#b64c3d'})[summary.severity];
  $('summary').innerHTML = `<div class="score-row"><span>Raw alert score</span><strong>${summary.raw}</strong></div>` + summary.adjustments.map(x => `<div class="score-row"><span>${esc(policyNames[x.policy] || x.policy)}</span><strong>${x.applied ? (x.points > 0 ? '+' : '') + x.points : 'Not applied'}</strong></div><p class="adjustment-note">${esc(x.note)}</p>`).join('') + `<div class="score-row total"><span>Final score</span><strong>${summary.final} / 100</strong></div>`;
  renderAlerts();
}
$('alerts').addEventListener('click', e => { const button = e.target.closest('[data-add]'); if(button) run(async () => renderCase(await api('POST','/api/case/alerts',{alertId:Number(button.dataset.add)}))); });
$('case').addEventListener('click', e => { const button = e.target.closest('[data-remove]'); if(button) run(async () => renderCase(await api('DELETE',`/api/case/alerts/${button.dataset.remove}`))); });
$('search').addEventListener('input', renderAlerts);
$('category').addEventListener('change', renderAlerts);
function syncPolicyText() {
  const policies = $('damping').checked ? ['REPEAT_NOISE_DAMPING'] : [];
  const escalation = document.querySelector('[name="escalation"]:checked').value;
  if(escalation) policies.push(escalation);
  $('policy').value = policies.join(', ');
  $('policy-status').textContent = 'Unsaved changes · apply to update the score.';
}
$('damping').addEventListener('change', syncPolicyText);
document.querySelectorAll('[name="escalation"]').forEach(input => input.addEventListener('change', syncPolicyText));
$('policy').addEventListener('input', () => {$('policy-status').textContent = 'Unsaved changes · apply to update the score.';});
$('policy-form').addEventListener('submit', e => {
  e.preventDefault();
  run(async () => {
    $('policy-status').textContent = 'Applying policies…';
    try {renderCase(await api('PUT','/api/case/policies',{policies:$('policy').value})); $('policy-status').textContent = 'Policies applied and saved.';}
    catch(err) {$('policy-status').textContent = 'Policies were not saved.'; throw err;}
  });
});
run(async () => {
  const [alerts, currentCase] = await Promise.all([api('GET','/api/alerts'),api('GET','/api/case')]);
  allAlerts = alerts;
  renderCase(currentCase);
});
