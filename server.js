const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tournament.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function verifyAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  if (sha256(token) !== data.settings.adminPasswordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  next();
}

function recalculateGroup(group) {
  group.teams.forEach(t => {
    t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0;
    t.gf = 0; t.ga = 0; t.gd = 0; t.pts = 0;
  });

  group.matches.filter(m => m.played).forEach(m => {
    const home = group.teams.find(t => t.name === m.home);
    const away = group.teams.find(t => t.name === m.away);
    if (!home || !away) return;

    home.played++; away.played++;
    home.gf += m.homeScore; home.ga += m.awayScore;
    away.gf += m.awayScore; away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++; home.pts += 3; away.lost++;
    } else if (m.homeScore < m.awayScore) {
      away.won++; away.pts += 3; home.lost++;
    } else {
      home.drawn++; home.pts++;
      away.drawn++; away.pts++;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  });

  group.teams.sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

app.get('/api/tournament', (_req, res) => {
  res.json(readData());
});

// ─── Admin Auth ────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const data = readData();
  if (sha256(password) === data.settings.adminPasswordHash) {
    res.json({ success: true, token: password });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// ─── Admin: Group matches ───────────────────────────────────────────────────────

app.put('/api/admin/group/:groupId/match/:matchIdx', verifyAdmin, (req, res) => {
  const data = readData();
  const group = data.groups.find(g => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const idx = parseInt(req.params.matchIdx, 10);
  const match = group.matches[idx];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { homeScore, awayScore } = req.body;
  if (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
    match.homeScore = parseInt(homeScore, 10);
    match.awayScore = parseInt(awayScore, 10);
    match.played = true;
  } else {
    match.homeScore = null;
    match.awayScore = null;
    match.played = false;
  }

  recalculateGroup(group);
  writeData(data);
  res.json({ success: true, group });
});

// ─── Admin: Group team names ───────────────────────────────────────────────────

app.put('/api/admin/group/:groupId/team/:teamIdx', verifyAdmin, (req, res) => {
  const data = readData();
  const group = data.groups.find(g => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const idx = parseInt(req.params.teamIdx, 10);
  const team = group.teams[idx];
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { name, flag } = req.body;
  const oldName = team.name;
  if (name) {
    team.name = name;
    group.matches.forEach(m => {
      if (m.home === oldName) m.home = name;
      if (m.away === oldName) m.away = name;
    });
  }
  if (flag !== undefined) team.flag = flag;

  writeData(data);
  res.json({ success: true, group });
});

// ─── Admin: Knockout matches ────────────────────────────────────────────────────

app.put('/api/admin/knockout/:round/:matchId', verifyAdmin, (req, res) => {
  const data = readData();
  const round = data.knockout[req.params.round];
  if (!round) return res.status(404).json({ error: 'Round not found' });

  let match;
  if (Array.isArray(round)) {
    match = round.find(m => String(m.id) === req.params.matchId);
  } else if (String(round.id) === req.params.matchId) {
    match = round;
  }
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const { home, away, homeScore, awayScore, homePenalty, awayPenalty } = req.body;
  if (home !== undefined) match.home = home;
  if (away !== undefined) match.away = away;
  if (homeScore !== undefined) match.homeScore = homeScore === null ? null : parseInt(homeScore, 10);
  if (awayScore !== undefined) match.awayScore = awayScore === null ? null : parseInt(awayScore, 10);
  if (homePenalty !== undefined) match.homePenalty = homePenalty === null ? null : parseInt(homePenalty, 10);
  if (awayPenalty !== undefined) match.awayPenalty = awayPenalty === null ? null : parseInt(awayPenalty, 10);
  match.played = match.homeScore !== null && match.awayScore !== null;

  writeData(data);
  res.json({ success: true, match });
});

// ─── Admin: Change password ─────────────────────────────────────────────────────

app.put('/api/admin/password', verifyAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const data = readData();
  data.settings.adminPasswordHash = sha256(newPassword);
  writeData(data);
  res.json({ success: true });
});

// ─── Admin: Settings (API mode) ─────────────────────────────────────────────────

app.put('/api/admin/settings', verifyAdmin, (req, res) => {
  const data = readData();
  const { apiKey, useApi } = req.body;
  if (apiKey !== undefined) data.settings.apiKey = apiKey;
  if (useApi !== undefined) data.settings.useApi = Boolean(useApi);
  writeData(data);
  if (data.settings.useApi && data.settings.apiKey) {
    fetchFromApi(data.settings.apiKey);
  }
  res.json({ success: true, settings: { useApi: data.settings.useApi, hasApiKey: !!data.settings.apiKey } });
});

// ─── Optional: football-data.org proxy ──────────────────────────────────────────

function fetchFromApi(apiKey) {
  const options = {
    hostname: 'api.football-data.org',
    path: '/v4/competitions/WC/matches',
    headers: { 'X-Auth-Token': apiKey }
  };
  https.get(options, (resp) => {
    let raw = '';
    resp.on('data', d => raw += d);
    resp.on('end', () => {
      try {
        const apiData = JSON.parse(raw);
        applyApiData(apiData);
      } catch (e) {
        console.error('API parse error:', e.message);
      }
    });
  }).on('error', e => console.error('API fetch error:', e.message));
}

function applyApiData(apiData) {
  if (!apiData.matches) return;
  const data = readData();

  apiData.matches.forEach(m => {
    if (m.stage === 'GROUP_STAGE') {
      const grpLetter = m.group ? m.group.replace('GROUP_', '') : null;
      if (!grpLetter) return;
      const group = data.groups.find(g => g.id === grpLetter);
      if (!group) return;
      const match = group.matches.find(gm => gm.home === m.homeTeam.shortName && gm.away === m.awayTeam.shortName);
      if (match && m.score.fullTime.home !== null) {
        match.homeScore = m.score.fullTime.home;
        match.awayScore = m.score.fullTime.away;
        match.played = true;
      }
    }
  });

  data.groups.forEach(g => recalculateGroup(g));
  writeData(data);
  console.log('Tournament data updated from API');
}

// ─── Serve admin ─────────────────────────────────────────────────────────────────

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── Auto-fetch if API enabled ─────────────────────────────────────────────────

const data = readData();
if (data.settings.useApi && data.settings.apiKey) {
  fetchFromApi(data.settings.apiKey);
  setInterval(() => {
    const d = readData();
    if (d.settings.useApi && d.settings.apiKey) fetchFromApi(d.settings.apiKey);
  }, 5 * 60 * 1000);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚽  FIFA World Cup 2026 → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel        → http://localhost:${PORT}/admin   (parol: admin123)`);
});
