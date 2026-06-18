let TOKEN = null;
let DATA  = null;

/* ─── Auth ──────────────────────────────────────────────────────────────────── */
async function doLogin() {
  const pw = document.getElementById('pw-input').value;
  if (!pw) return;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const json = await res.json();
    if (!res.ok) { showToast(json.error || 'Xato parol', true); return; }
    TOKEN = json.token;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    document.getElementById('logout-btn').style.display = '';
    document.getElementById('admin-user-label').textContent = '✓ Admin sifatida kirgansiz';
    loadData();
  } catch (e) {
    showToast('Server bilan bog\'lanib bo\'lmadi', true);
  }
}

function logout() {
  TOKEN = null;
  DATA  = null;
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('admin-content').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('pw-input').value = '';
}

/* ─── Data ──────────────────────────────────────────────────────────────────── */
async function loadData() {
  const res = await fetch('/api/tournament');
  DATA = await res.json();
  renderGroupAdmin(DATA.groups);
  renderKnockoutAdmin(DATA.knockout);
  document.getElementById('use-api-toggle').checked = DATA.settings.useApi;
}

/* ─── Tab switching ─────────────────────────────────────────────────────────── */
function switchPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  event.target.classList.add('active');
}

/* ─── Groups ────────────────────────────────────────────────────────────────── */
function renderGroupAdmin(groups) {
  const grid = document.getElementById('group-admin-grid');
  grid.innerHTML = groups.map(g => renderGroupAdminCard(g)).join('');
}

function renderGroupAdminCard(g) {
  const matchRows = g.matches.map((m, i) => `
    <div class="match-editor">
      <span class="teams">${m.home} vs ${m.away}</span>
      <input class="score-input" type="number" min="0" max="99"
        id="g${g.id}m${i}h"
        value="${m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : ''}"
        placeholder="-">
      <span class="score-sep">:</span>
      <input class="score-input" type="number" min="0" max="99"
        id="g${g.id}m${i}a"
        value="${m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : ''}"
        placeholder="-">
      <button class="btn btn-green btn-sm" onclick="saveGroupMatch('${g.id}', ${i})">✓</button>
      <button class="btn btn-outline btn-sm" onclick="clearGroupMatch('${g.id}', ${i})">✕</button>
    </div>`).join('');

  return `
  <div class="group-admin-card">
    <div class="group-admin-header">
      <span class="group-admin-label">GURUH ${g.id}</span>
      <button class="btn btn-green btn-sm" onclick="saveAllGroupMatches('${g.id}')">Barchasini Saqlash</button>
    </div>
    ${matchRows}
  </div>`;
}

async function saveGroupMatch(groupId, matchIdx) {
  const h = document.getElementById(`g${groupId}m${matchIdx}h`).value;
  const a = document.getElementById(`g${groupId}m${matchIdx}a`).value;

  const homeScore = h !== '' ? parseInt(h, 10) : null;
  const awayScore = a !== '' ? parseInt(a, 10) : null;

  try {
    const res = await fetch(`/api/admin/group/${groupId}/match/${matchIdx}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
      body: JSON.stringify({ homeScore, awayScore })
    });
    if (!res.ok) { const j = await res.json(); showToast(j.error, true); return; }
    showToast(`Guruh ${groupId} M${matchIdx + 1} saqlandi ✓`);
    loadData();
  } catch (e) {
    showToast('Xato: ' + e.message, true);
  }
}

async function clearGroupMatch(groupId, matchIdx) {
  document.getElementById(`g${groupId}m${matchIdx}h`).value = '';
  document.getElementById(`g${groupId}m${matchIdx}a`).value = '';
  await saveGroupMatch(groupId, matchIdx);
}

async function saveAllGroupMatches(groupId) {
  const group = DATA.groups.find(g => g.id === groupId);
  if (!group) return;
  for (let i = 0; i < group.matches.length; i++) {
    const h = document.getElementById(`g${groupId}m${i}h`);
    const a = document.getElementById(`g${groupId}m${i}a`);
    if (h && a) await saveGroupMatch(groupId, i);
  }
  showToast(`Guruh ${groupId} barcha o'yinlari saqlandi ✓`);
}

/* ─── Knockout ──────────────────────────────────────────────────────────────── */
const ROUND_NAMES = {
  round_of_32:   'R32 — 32 dan 16',
  round_of_16:   'R16 — 16 dan 8',
  quarter_finals: 'Chorak Final',
  semi_finals:   'Yarim Final',
  third_place:   'Uchinchi O\'rin',
  final:         'FINAL'
};

function renderKnockoutAdmin(knockout) {
  const container = document.getElementById('knockout-admin');
  const rounds = ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final'];

  container.innerHTML = rounds.map(round => {
    const matches = Array.isArray(knockout[round]) ? knockout[round] : [knockout[round]];
    const cards = matches.map(m => knockoutEditorCard(round, m)).join('');
    return `
    <div class="round-section">
      <div class="round-title">${ROUND_NAMES[round] || round}</div>
      <div class="knockout-grid">${cards}</div>
    </div>`;
  }).join('');
}

function knockoutEditorCard(round, m) {
  const hScore = m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : '';
  const aScore = m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : '';
  const hPen   = m.homePenalty !== null && m.homePenalty !== undefined ? m.homePenalty : '';
  const aPen   = m.awayPenalty !== null && m.awayPenalty !== undefined ? m.awayPenalty : '';

  return `
  <div class="knockout-editor">
    <div style="font-size:0.7rem;color:var(--text3);font-weight:700">Match #${m.id} · ${m.date || ''}</div>

    <div class="knockout-editor-row">
      <span style="font-size:0.75rem;color:var(--text2);min-width:50px">Uy:</span>
      <input class="team-input" type="text" id="km${m.id}hn" value="${m.home || ''}" placeholder="Jamoa nomi…">
      <input class="score-input" type="number" min="0" id="km${m.id}hs" value="${hScore}" placeholder="-">
      <input class="score-input" type="number" min="0" id="km${m.id}hp" value="${hPen}" placeholder="P" title="Penalti">
    </div>

    <div class="knockout-editor-row">
      <span style="font-size:0.75rem;color:var(--text2);min-width:50px">Mehmon:</span>
      <input class="team-input" type="text" id="km${m.id}an" value="${m.away || ''}" placeholder="Jamoa nomi…">
      <input class="score-input" type="number" min="0" id="km${m.id}as" value="${aScore}" placeholder="-">
      <input class="score-input" type="number" min="0" id="km${m.id}ap" value="${aPen}" placeholder="P" title="Penalti">
    </div>

    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="btn btn-green btn-sm" onclick="saveKnockoutMatch('${round}', ${m.id})">✓ Saqlash</button>
      <button class="btn btn-outline btn-sm" onclick="clearKnockoutMatch('${round}', ${m.id})">✕ Tozalash</button>
    </div>
  </div>`;
}

async function saveKnockoutMatch(round, matchId) {
  const get = id => {
    const el = document.getElementById(id);
    return el ? el.value : null;
  };
  const v = val => val !== '' && val !== null && val !== undefined ? parseInt(val, 10) : null;

  const body = {
    home:        get(`km${matchId}hn`) || undefined,
    away:        get(`km${matchId}an`) || undefined,
    homeScore:   v(get(`km${matchId}hs`)),
    awayScore:   v(get(`km${matchId}as`)),
    homePenalty: v(get(`km${matchId}hp`)),
    awayPenalty: v(get(`km${matchId}ap`))
  };

  try {
    const res = await fetch(`/api/admin/knockout/${round}/${matchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const j = await res.json(); showToast(j.error, true); return; }
    showToast(`Match #${matchId} saqlandi ✓`);
    loadData();
  } catch (e) {
    showToast('Xato: ' + e.message, true);
  }
}

async function clearKnockoutMatch(round, matchId) {
  ['hs', 'as', 'hp', 'ap'].forEach(s => {
    const el = document.getElementById(`km${matchId}${s}`);
    if (el) el.value = '';
  });
  await saveKnockoutMatch(round, matchId);
}

/* ─── Settings ──────────────────────────────────────────────────────────────── */
async function saveApiSettings() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  const useApi = document.getElementById('use-api-toggle').checked;

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
      body: JSON.stringify({ apiKey, useApi })
    });
    if (!res.ok) { const j = await res.json(); showToast(j.error, true); return; }
    showToast('API sozlamalari saqlandi ✓');
  } catch (e) {
    showToast('Xato: ' + e.message, true);
  }
}

async function changePassword() {
  const np  = document.getElementById('new-pw').value;
  const np2 = document.getElementById('new-pw2').value;
  if (!np || np.length < 6) { showToast('Parol kamida 6 belgidan iborat bo\'lishi kerak', true); return; }
  if (np !== np2) { showToast('Parollar mos kelmadi', true); return; }

  try {
    const res = await fetch('/api/admin/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
      body: JSON.stringify({ newPassword: np })
    });
    if (!res.ok) { const j = await res.json(); showToast(j.error, true); return; }
    TOKEN = np;
    showToast('Parol muvaffaqiyatli o\'zgartirildi ✓');
    document.getElementById('new-pw').value = '';
    document.getElementById('new-pw2').value = '';
  } catch (e) {
    showToast('Xato: ' + e.message, true);
  }
}

/* ─── Toast ─────────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}
