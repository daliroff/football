/* ──────────────────────────────────────────────────────────────────────────────
   Admin JS — GitHub API orqali data.json ni to'g'ridan-to'g'ri repoda yangilaydi.
   Token faqat localStorage'da saqlanadi, serverga yuborilmaydi.
────────────────────────────────────────────────────────────────────────────── */

let GH = {
  token:  localStorage.getItem('gh_token')  || '',
  repo:   localStorage.getItem('gh_repo')   || 'daliroff/football',
  branch: localStorage.getItem('gh_branch') || 'main'
};

let DATA    = null;   // joriy tournament ma'lumotlari
let FILE_SHA = null;  // GitHub dagi data.json ning SHA (update uchun kerak)
let DIRTY   = false;  // o'zgartirishlar bor-yo'qligi

/* ─── GitHub ulanish ────────────────────────────────────────────────────────── */
async function connectGitHub() {
  const token  = document.getElementById('gh-token').value.trim();
  const repo   = document.getElementById('gh-repo').value.trim();
  const branch = document.getElementById('gh-branch').value.trim();

  if (!token)  { showBar('err', 'Token kiritilmagan'); return; }
  if (!repo)   { showBar('err', 'Repo nomi kiritilmagan'); return; }
  if (!branch) { showBar('err', 'Branch nomi kiritilmagan'); return; }

  GH = { token, repo, branch };
  localStorage.setItem('gh_token',  token);
  localStorage.setItem('gh_repo',   repo);
  localStorage.setItem('gh_branch', branch);

  showBar('warn', 'Ulanmoqda…');

  try {
    await fetchDataFromGitHub();
    showBar('ok', `✓ Ulandi: ${repo} (${branch}) — data.json o'qildi`);
    document.getElementById('conn-status').textContent = `✓ ${repo} / ${branch} ga ulangan`;
    document.getElementById('admin-content').style.display = 'block';
    renderGroupAdmin(DATA.groups);
    renderKnockoutAdmin(DATA.knockout);
  } catch (e) {
    showBar('err', 'Xato: ' + e.message);
  }
}

/* ─── GitHub API: data.json o'qish ─────────────────────────────────────────── */
async function fetchDataFromGitHub() {
  const url = `https://api.github.com/repos/${GH.repo}/contents/data.json?ref=${GH.branch}&t=${Date.now()}`;
  const res = await fetch(url, { headers: ghHeaders() });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `HTTP ${res.status}`);
  }

  const fileInfo = await res.json();
  FILE_SHA = fileInfo.sha;

  // GitHub base64 → string → parse JSON
  const content = decodeURIComponent(escape(atob(fileInfo.content.replace(/\s/g, ''))));
  DATA = JSON.parse(content);
  DATA.groups.forEach(recalcGroup);
  return DATA;
}

/* ─── GitHub API: data.json saqlash ────────────────────────────────────────── */
async function saveToGitHub() {
  if (!DATA)  { showToast('Avval GitHub ga ulaning', true); return; }
  if (!DIRTY) { showToast('O\'zgartirishlar yo\'q', false); return; }

  showToast('GitHub ga saqlanmoqda…');

  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(DATA, null, 2))));
    const body = {
      message: 'Update tournament results',
      content,
      sha:    FILE_SHA,
      branch: GH.branch
    };

    const res = await fetch(`https://api.github.com/repos/${GH.repo}/contents/data.json`, {
      method:  'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || `HTTP ${res.status}`);
    }

    const result = await res.json();
    FILE_SHA = result.content.sha;

    setDirty(false);
    showToast('✓ GitHub ga saqlandi! Sayt ~1 daqiqada yangilanadi.');
  } catch (e) {
    showToast('Xato: ' + e.message, true);
  }
}

function discardChanges() {
  if (!confirm('O\'zgartirishlarni bekor qilasizmi?')) return;
  fetchDataFromGitHub().then(() => {
    renderGroupAdmin(DATA.groups);
    renderKnockoutAdmin(DATA.knockout);
    setDirty(false);
    showToast('Bekor qilindi');
  }).catch(e => showToast('Xato: ' + e.message, true));
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function ghHeaders() {
  return {
    'Authorization': `token ${GH.token}`,
    'Accept': 'application/vnd.github.v3+json'
  };
}

function recalcGroup(group) {
  group.teams.forEach(t => { t.played=0;t.won=0;t.drawn=0;t.lost=0;t.gf=0;t.ga=0;t.gd=0;t.pts=0; });
  group.matches.filter(m => m.played).forEach(m => {
    const home = group.teams.find(t => t.name === m.home);
    const away = group.teams.find(t => t.name === m.away);
    if (!home || !away) return;
    home.played++; away.played++;
    home.gf += m.homeScore; home.ga += m.awayScore;
    away.gf += m.awayScore; away.ga += m.homeScore;
    if (m.homeScore > m.awayScore)      { home.won++;home.pts+=3;away.lost++; }
    else if (m.homeScore < m.awayScore) { away.won++;away.pts+=3;home.lost++; }
    else { home.drawn++;home.pts++;away.drawn++;away.pts++; }
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  });
  group.teams.sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.name.localeCompare(b.name));
}

function setDirty(val) {
  DIRTY = val;
  const bar = document.getElementById('save-bar');
  if (val) {
    bar.classList.add('visible');
    document.getElementById('save-bar-text').textContent = 'Saqlanmagan o\'zgartirishlar bor';
  } else {
    bar.classList.remove('visible');
  }
}

/* ─── Tab switching ─────────────────────────────────────────────────────────── */
function switchPanel(name, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
}

/* ─── Groups ────────────────────────────────────────────────────────────────── */
function renderGroupAdmin(groups) {
  document.getElementById('group-admin-grid').innerHTML = groups.map(renderGroupAdminCard).join('');
}

function renderGroupAdminCard(g) {
  const rows = g.matches.map((m, i) => `
    <div class="match-editor">
      <span class="teams">${m.home} — ${m.away}</span>
      <input class="score-input" type="number" min="0" max="99"
        id="g${g.id}m${i}h"
        value="${m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : ''}"
        placeholder="-"
        onchange="updateGroupMatch('${g.id}',${i})">
      <span class="score-sep">:</span>
      <input class="score-input" type="number" min="0" max="99"
        id="g${g.id}m${i}a"
        value="${m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : ''}"
        placeholder="-"
        onchange="updateGroupMatch('${g.id}',${i})">
      <button class="btn btn-outline btn-sm" onclick="clearGroupMatch('${g.id}',${i})" title="Tozalash">✕</button>
    </div>`).join('');

  return `
  <div class="group-admin-card">
    <div class="group-admin-header">
      <span class="group-admin-label">GURUH ${g.id}</span>
    </div>
    ${rows}
  </div>`;
}

function updateGroupMatch(groupId, matchIdx) {
  if (!DATA) return;
  const group = DATA.groups.find(g => g.id === groupId);
  if (!group) return;

  const h = document.getElementById(`g${groupId}m${matchIdx}h`).value;
  const a = document.getElementById(`g${groupId}m${matchIdx}a`).value;
  const match = group.matches[matchIdx];

  if (h !== '' && a !== '') {
    match.homeScore = parseInt(h, 10);
    match.awayScore = parseInt(a, 10);
    match.played = true;
  } else {
    match.homeScore = null;
    match.awayScore = null;
    match.played = false;
  }

  recalcGroup(group);
  setDirty(true);
}

function clearGroupMatch(groupId, matchIdx) {
  document.getElementById(`g${groupId}m${matchIdx}h`).value = '';
  document.getElementById(`g${groupId}m${matchIdx}a`).value = '';
  updateGroupMatch(groupId, matchIdx);
}

/* ─── Knockout ──────────────────────────────────────────────────────────────── */
const ROUND_LABELS = {
  round_of_32:   'R32 — 32 dan 16',
  round_of_16:   'R16 — 16 dan 8',
  quarter_finals: 'Chorak Final',
  semi_finals:   "Yarim Final",
  third_place:   "Uchinchi O'rin",
  final:         'FINAL'
};

function renderKnockoutAdmin(knockout) {
  const rounds = ['round_of_32','round_of_16','quarter_finals','semi_finals','third_place','final'];
  document.getElementById('knockout-admin').innerHTML = rounds.map(round => {
    const matches = Array.isArray(knockout[round]) ? knockout[round] : [knockout[round]];
    return `
    <div class="round-section">
      <div class="round-title">${ROUND_LABELS[round]||round}</div>
      <div class="knockout-grid">${matches.map(m => knockoutCard(round, m)).join('')}</div>
    </div>`;
  }).join('');
}

function knockoutCard(round, m) {
  const v = x => (x !== null && x !== undefined) ? x : '';
  return `
  <div class="knockout-editor">
    <div style="font-size:0.68rem;color:var(--text3);font-weight:700">Match #${m.id} · ${m.date||''} · ${m.venue||''}</div>

    <div class="knockout-editor-row">
      <span style="font-size:0.72rem;color:var(--text2);min-width:50px">Uy:</span>
      <input class="team-input" type="text"   id="km${m.id}hn" value="${v(m.home)}" placeholder="Jamoa…"   oninput="updateKnockout('${round}',${m.id})">
      <input class="score-input" type="number" id="km${m.id}hs" value="${v(m.homeScore)}" placeholder="-" onchange="updateKnockout('${round}',${m.id})">
      <input class="score-input" type="number" id="km${m.id}hp" value="${v(m.homePenalty)}" placeholder="P" title="Penalti" onchange="updateKnockout('${round}',${m.id})">
    </div>

    <div class="knockout-editor-row">
      <span style="font-size:0.72rem;color:var(--text2);min-width:50px">Mehmon:</span>
      <input class="team-input" type="text"   id="km${m.id}an" value="${v(m.away)}" placeholder="Jamoa…"   oninput="updateKnockout('${round}',${m.id})">
      <input class="score-input" type="number" id="km${m.id}as" value="${v(m.awayScore)}" placeholder="-" onchange="updateKnockout('${round}',${m.id})">
      <input class="score-input" type="number" id="km${m.id}ap" value="${v(m.awayPenalty)}" placeholder="P" title="Penalti" onchange="updateKnockout('${round}',${m.id})">
    </div>

    <button class="btn btn-outline btn-sm" style="align-self:flex-start" onclick="clearKnockoutMatch('${round}',${m.id})">✕ Tozalash</button>
  </div>`;
}

function updateKnockout(round, matchId) {
  if (!DATA) return;
  const arr = Array.isArray(DATA.knockout[round]) ? DATA.knockout[round] : [DATA.knockout[round]];
  const match = arr.find(m => m.id === matchId);
  if (!match) return;

  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const num = v => v !== '' ? parseInt(v, 10) : null;

  match.home        = g(`km${matchId}hn`) || match.home;
  match.away        = g(`km${matchId}an`) || match.away;
  match.homeScore   = num(g(`km${matchId}hs`));
  match.awayScore   = num(g(`km${matchId}as`));
  match.homePenalty = num(g(`km${matchId}hp`));
  match.awayPenalty = num(g(`km${matchId}ap`));
  match.played = match.homeScore !== null && match.awayScore !== null;

  setDirty(true);
}

function clearKnockoutMatch(round, matchId) {
  ['hs','as','hp','ap'].forEach(s => {
    const el = document.getElementById(`km${matchId}${s}`);
    if (el) el.value = '';
  });
  updateKnockout(round, matchId);
}

/* ─── UI helpers ────────────────────────────────────────────────────────────── */
function showBar(type, msg) {
  const bar = document.getElementById('conn-bar');
  bar.className = 'status-bar ' + type;
  bar.textContent = msg;
}

let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3500);
}

/* ─── Auto-fill token fields from localStorage ────────────────────────────── */
(function init() {
  const token  = localStorage.getItem('gh_token');
  const repo   = localStorage.getItem('gh_repo');
  const branch = localStorage.getItem('gh_branch');
  if (token)  document.getElementById('gh-token').value  = token;
  if (repo)   document.getElementById('gh-repo').value   = repo;
  if (branch) document.getElementById('gh-branch').value = branch;
})();
