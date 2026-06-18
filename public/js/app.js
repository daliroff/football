/* ─── Tab switching ─────────────────────────────────────────────────────────── */
function showTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-section').classList.add('active');
  document.querySelectorAll('.nav-btn')[name === 'groups' ? 0 : 1].classList.add('active');
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmt(score) {
  return score === null || score === undefined ? '-' : score;
}

function fmtDate(dateStr, time) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (time ? 'T' + time : ''));
  return d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }) + (time ? ' ' + time : '');
}

function isTBD(name) {
  return !name || name === 'TBD' || /^(G-|1[A-L]|2[A-L]|3rd)/.test(name);
}

/* ─── Groups ────────────────────────────────────────────────────────────────── */
function renderGroups(groups) {
  const grid = document.getElementById('groups-grid');
  grid.innerHTML = groups.map(g => renderGroupCard(g)).join('');
}

function renderGroupCard(g) {
  const played = g.matches.filter(m => m.played).length;
  const total  = g.matches.length;

  const rows = g.teams.map((t, i) => {
    const cls = i === 0 ? 'advance-row-1' : i === 1 ? 'advance-row-2' : i === 2 ? 'possible-row' : '';
    const posCls = `pos-${i + 1}`;
    return `
    <tr class="${cls}">
      <td>
        <div class="team-name-cell">
          <span class="pos-badge ${posCls}">${i + 1}</span>
          <span class="team-flag">${t.flag || '🏳'}</span>
          <span>${t.name}</span>
        </div>
      </td>
      <td>${t.played}</td>
      <td>${t.won}</td>
      <td>${t.drawn}</td>
      <td>${t.lost}</td>
      <td>${t.gf}</td>
      <td>${t.ga}</td>
      <td>${t.gd >= 0 && t.gd > 0 ? '+' : ''}${t.gd}</td>
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
      <span class="group-matches-count">${played}/${total} o'yin</span>
    </div>
    <table class="standings-table">
      <thead>
        <tr>
          <th>Jamoa</th>
          <th title="O'ynagan">O</th>
          <th title="G'alaba">G</th>
          <th title="Durrang">D</th>
          <th title="Mag'lubiyat">M</th>
          <th title="Kiritilgan">KG</th>
          <th title="O'tkazilgan">OG</th>
          <th title="Farq">GF</th>
          <th title="Ochko">Och</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="group-matches">${matchRows}</div>
  </div>`;
}

/* ─── Bracket ───────────────────────────────────────────────────────────────── */
function renderBracket(knockout) {
  const container = document.getElementById('bracket-container');

  const r32  = knockout.round_of_32;
  const r16  = knockout.round_of_16;
  const qf   = knockout.quarter_finals;
  const sf   = knockout.semi_finals;
  const tp   = knockout.third_place;
  const fin  = knockout.final;

  // Split each round into left (first half) and right (second half)
  const left  = { r32: r32.slice(0,8),  r16: r16.slice(0,4), qf: qf.slice(0,2), sf: [sf[0]] };
  const right = { r32: r32.slice(8,16), r16: r16.slice(4,8), qf: qf.slice(2,4), sf: [sf[1]] };

  container.innerHTML = `
  <div class="bracket-wrapper">
    ${buildSide(left, 'left')}
    <div class="bracket-final-col">
      <div class="final-label">⚽ FINAL</div>
      ${matchCard(fin, true)}
      <div class="third-place-label">🥉 Uchinchi o'rin</div>
      ${matchCard(tp, false)}
    </div>
    ${buildSide(right, 'right')}
  </div>`;
}

function buildSide(data, side) {
  return `
  <div class="bracket-side ${side}">
    ${buildRound(data.r32, 'R32', 8)}
    ${buildRound(data.r16, 'R16', 4)}
    ${buildRound(data.qf,  'Chorak Final', 2)}
    ${buildRound(data.sf,  'Yarim Final', 1)}
  </div>`;
}

function buildRound(matches, label, count) {
  const pairs = [];
  for (let i = 0; i < matches.length; i += 2) {
    if (matches[i + 1]) {
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

  const homeFlag = getFlag(m.home);
  const awayFlag = getFlag(m.away);

  const homePen = (m.homePenalty !== null && m.homePenalty !== undefined) ? `<span class="row-pen">(${m.homePenalty})</span>` : '';
  const awayPen = (m.awayPenalty !== null && m.awayPenalty !== undefined) ? `<span class="row-pen">(${m.awayPenalty})</span>` : '';

  const homeScore = m.played ? `<span class="row-score">${fmt(m.homeScore)}</span>` : `<span class="row-score" style="color:var(--text3)">-</span>`;
  const awayScore = m.played ? `<span class="row-score">${fmt(m.awayScore)}</span>` : `<span class="row-score" style="color:var(--text3)">-</span>`;

  const dateStr = m.date ? `<div class="match-card-date">${fmtDate(m.date)} · ${m.venue || ''}</div>` : '';

  return `
  <div class="match-card ${isFinal ? 'match-final' : ''}" title="${m.venue || ''}">
    <div class="match-row ${homeWin ? 'winner' : ''}">
      <span class="row-flag">${homeFlag}</span>
      <span class="row-name ${isTBD(m.home) ? 'tbd' : ''}">${m.home || 'TBD'}</span>
      ${homePen}
      ${homeScore}
    </div>
    <div class="match-row ${awayWin ? 'winner' : ''}">
      <span class="row-flag">${awayFlag}</span>
      <span class="row-name ${isTBD(m.away) ? 'tbd' : ''}">${m.away || 'TBD'}</span>
      ${awayPen}
      ${awayScore}
    </div>
    ${dateStr}
  </div>`;
}

/* ─── Flag cache ────────────────────────────────────────────────────────────── */
const FLAGS = {
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Spain': '🇪🇸', 'Germany': '🇩🇪', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪', 'Italy': '🇮🇹', 'Croatia': '🇭🇷', 'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴', 'Mexico': '🇲🇽', 'USA': '🇺🇸', 'Canada': '🇨🇦',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Australia': '🇦🇺', 'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Switzerland': '🇨🇭',
  'Denmark': '🇩🇰', 'Austria': '🇦🇹', 'Poland': '🇵🇱', 'Serbia': '🇷🇸',
  'Turkey': '🇹🇷', 'Ecuador': '🇪🇨', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
  'Cameroon': '🇨🇲', 'Tunisia': '🇹🇳', 'Ghana': '🇬🇭', 'Algeria': '🇩🇿',
  'Ivory Coast': '🇨🇮', 'Jamaica': '🇯🇲', 'Honduras': '🇭🇳', 'Panama': '🇵🇦',
  'Costa Rica': '🇨🇷', 'Venezuela': '🇻🇪', 'New Zealand': '🇳🇿', 'Uzbekistan': '🇺🇿',
  'Iraq': '🇮🇶', 'Paraguay': '🇵🇾', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Indonesia': '🇮🇩',
  'El Salvador': '🇸🇻'
};

function getFlag(name) {
  if (!name || isTBD(name)) return '🏳';
  return FLAGS[name] || '🏳';
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */
async function load() {
  try {
    const res  = await fetch('/api/tournament');
    const data = await res.json();
    renderGroups(data.groups);
    renderBracket(data.knockout);
    const el = document.getElementById('last-updated');
    el.textContent = `Oxirgi yangilanish: ${new Date().toLocaleString('uz-UZ')}`;
  } catch (e) {
    console.error('Yuklashda xato:', e);
  }
}

load();
setInterval(load, 60_000);
