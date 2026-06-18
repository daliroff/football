/* ─── Tab switching ─────────────────────────────────────────────────────────── */
function showTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-section').classList.add('active');
  document.querySelectorAll('.nav-btn')[name === 'groups' ? 0 : 1].classList.add('active');
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmt(score) { return score === null || score === undefined ? '-' : score; }

function fmtDate(dateStr, time) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (time ? 'T' + time : ''));
  return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }) + (time ? ' ' + time : '');
}

function isTBD(name) {
  return !name || name === 'TBD' || /^(G-|1[A-L]|2[A-L]|3rd|Mag|G'o)/.test(name);
}

const FLAGS = {
  'Brazil':'🇧🇷','Argentina':'🇦🇷','France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Spain':'🇪🇸','Germany':'🇩🇪','Portugal':'🇵🇹','Netherlands':'🇳🇱',
  'Belgium':'🇧🇪','Italy':'🇮🇹','Croatia':'🇭🇷','Uruguay':'🇺🇾',
  'Colombia':'🇨🇴','Mexico':'🇲🇽','USA':'🇺🇸','Canada':'🇨🇦',
  'Morocco':'🇲🇦','Senegal':'🇸🇳','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Australia':'🇦🇺','Saudi Arabia':'🇸🇦','Iran':'🇮🇷','Switzerland':'🇨🇭',
  'Denmark':'🇩🇰','Austria':'🇦🇹','Poland':'🇵🇱','Serbia':'🇷🇸',
  'Turkey':'🇹🇷','Ecuador':'🇪🇨','Nigeria':'🇳🇬','Egypt':'🇪🇬',
  'Cameroon':'🇨🇲','Tunisia':'🇹🇳','Ghana':'🇬🇭','Algeria':'🇩🇿',
  'Ivory Coast':'🇨🇮','Jamaica':'🇯🇲','Honduras':'🇭🇳','Panama':'🇵🇦',
  'Costa Rica':'🇨🇷','Venezuela':'🇻🇪','New Zealand':'🇳🇿','Uzbekistan':'🇺🇿',
  'Iraq':'🇮🇶','Paraguay':'🇵🇾','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Indonesia':'🇮🇩',
  'El Salvador':'🇸🇻'
};

function getFlag(name) {
  if (!name || isTBD(name)) return '🏳';
  return FLAGS[name] || '🏳';
}

/* ─── Groups ────────────────────────────────────────────────────────────────── */
function renderGroups(groups) {
  document.getElementById('groups-grid').innerHTML = groups.map(renderGroupCard).join('');
}

function renderGroupCard(g) {
  const played = g.matches.filter(m => m.played).length;

  const rows = g.teams.map((t, i) => {
    const cls = i === 0 ? 'advance-row-1' : i === 1 ? 'advance-row-2' : i === 2 ? 'possible-row' : '';
    return `
    <tr class="${cls}">
      <td><div class="team-name-cell">
        <span class="pos-badge pos-${i+1}">${i+1}</span>
        <span class="team-flag">${t.flag||'🏳'}</span>
        <span>${t.name}</span>
      </div></td>
      <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
      <td>${t.gf}</td><td>${t.ga}</td>
      <td>${t.gd>0?'+':''}${t.gd}</td>
      <td class="pts-cell">${t.pts}</td>
    </tr>`;
  }).join('');

  const matchRows = g.matches.map(m => {
    const score = m.played
      ? `<div class="match-score">${m.homeScore} : ${m.awayScore}</div>`
      : `<div class="match-score not-played">vs</div>`;
    return `
    <div class="group-match">
      <div class="match-teams">
        <span class="match-team-name">${m.home}</span>
        <span class="match-vs">vs</span>
        <span class="match-team-name">${m.away}</span>
      </div>
      ${score}
      <span class="match-date">${fmtDate(m.date, m.time)}</span>
    </div>`;
  }).join('');

  return `
  <div class="group-card">
    <div class="group-header">
      <span class="group-label">GURUH ${g.id}</span>
      <span class="group-matches-count">${played}/${g.matches.length} o'yin</span>
    </div>
    <table class="standings-table">
      <thead><tr>
        <th>Jamoa</th><th>O</th><th>G</th><th>D</th><th>M</th>
        <th>KG</th><th>OG</th><th>GF</th><th>Och</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="group-matches">${matchRows}</div>
  </div>`;
}

/* ─── Bracket ───────────────────────────────────────────────────────────────── */
function renderBracket(knockout) {
  const r32 = knockout.round_of_32;
  const r16 = knockout.round_of_16;
  const qf  = knockout.quarter_finals;
  const sf  = knockout.semi_finals;

  const left  = { r32: r32.slice(0,8),  r16: r16.slice(0,4), qf: qf.slice(0,2), sf: [sf[0]] };
  const right = { r32: r32.slice(8,16), r16: r16.slice(4,8), qf: qf.slice(2,4), sf: [sf[1]] };

  document.getElementById('bracket-container').innerHTML = `
  <div class="bracket-wrapper">
    ${buildSide(left,'left')}
    <div class="bracket-final-col">
      <div class="final-label">⚽ FINAL</div>
      ${matchCard(knockout.final, true)}
      <div class="third-place-label">🥉 Uchinchi o'rin</div>
      ${matchCard(knockout.third_place)}
    </div>
    ${buildSide(right,'right')}
  </div>`;
}

function buildSide(data, side) {
  return `
  <div class="bracket-side ${side}">
    ${buildRound(data.r32,'R32')}
    ${buildRound(data.r16,'R16')}
    ${buildRound(data.qf,'Chorak Final')}
    ${buildRound(data.sf,'Yarim Final')}
  </div>`;
}

function buildRound(matches, label) {
  const pairs = [];
  for (let i = 0; i < matches.length; i += 2) {
    if (matches[i+1]) {
      pairs.push(`
      <div class="bracket-match-pair">
        <div class="bracket-match-slot">${matchCard(matches[i])}</div>
        <div class="bracket-match-slot">${matchCard(matches[i+1])}</div>
      </div>`);
    } else {
      pairs.push(`<div class="bracket-match-slot">${matchCard(matches[i])}</div>`);
    }
  }
  return `
  <div class="bracket-round">
    <div class="bracket-round-label">${label}</div>
    ${pairs.join('')}
  </div>`;
}

function matchCard(m, isFinal = false) {
  if (!m) return '';
  const homeWin = m.played && (m.homeScore > m.awayScore || m.homePenalty > m.awayPenalty);
  const awayWin = m.played && (m.awayScore > m.homeScore || m.awayPenalty > m.homePenalty);
  const hPen = m.homePenalty != null ? `<span class="row-pen">(${m.homePenalty})</span>` : '';
  const aPen = m.awayPenalty != null ? `<span class="row-pen">(${m.awayPenalty})</span>` : '';
  const hSc  = m.played ? `<span class="row-score">${fmt(m.homeScore)}</span>` : `<span class="row-score" style="color:var(--text3)">-</span>`;
  const aSc  = m.played ? `<span class="row-score">${fmt(m.awayScore)}</span>` : `<span class="row-score" style="color:var(--text3)">-</span>`;
  const dateStr = m.date ? `<div class="match-card-date">${fmtDate(m.date)} · ${m.venue||''}</div>` : '';

  return `
  <div class="match-card${isFinal?' match-final':''}" title="${m.venue||''}">
    <div class="match-row${homeWin?' winner':''}">
      <span class="row-flag">${getFlag(m.home)}</span>
      <span class="row-name${isTBD(m.home)?' tbd':''}">${m.home||'TBD'}</span>
      ${hPen}${hSc}
    </div>
    <div class="match-row${awayWin?' winner':''}">
      <span class="row-flag">${getFlag(m.away)}</span>
      <span class="row-name${isTBD(m.away)?' tbd':''}">${m.away||'TBD'}</span>
      ${aPen}${aSc}
    </div>
    ${dateStr}
  </div>`;
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */
function recalcGroup(group) {
  group.teams.forEach(t => { t.played=0;t.won=0;t.drawn=0;t.lost=0;t.gf=0;t.ga=0;t.gd=0;t.pts=0; });
  group.matches.filter(m=>m.played).forEach(m => {
    const home = group.teams.find(t=>t.name===m.home);
    const away = group.teams.find(t=>t.name===m.away);
    if (!home||!away) return;
    home.played++; away.played++;
    home.gf+=m.homeScore; home.ga+=m.awayScore;
    away.gf+=m.awayScore; away.ga+=m.homeScore;
    if (m.homeScore>m.awayScore) { home.won++;home.pts+=3;away.lost++; }
    else if (m.homeScore<m.awayScore) { away.won++;away.pts+=3;home.lost++; }
    else { home.drawn++;home.pts++;away.drawn++;away.pts++; }
    home.gd=home.gf-home.ga; away.gd=away.gf-away.ga;
  });
  group.teams.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
}

async function load() {
  try {
    const res  = await fetch('data.json?t=' + Date.now());
    const data = await res.json();
    data.groups.forEach(recalcGroup);
    renderGroups(data.groups);
    renderBracket(data.knockout);
    document.getElementById('last-updated').textContent =
      'Oxirgi yangilanish: ' + new Date().toLocaleString('uz-UZ');
  } catch (e) {
    document.getElementById('groups-grid').innerHTML =
      '<div class="loading" style="color:#f44336">⚠ Ma\'lumot yuklanmadi: ' + e.message + '</div>';
  }
}

load();
setInterval(load, 60_000);
