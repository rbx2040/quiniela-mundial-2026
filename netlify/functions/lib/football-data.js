export const TOURNAMENTS = {
  WC2026: { code: 'WC', type: 'KNOCKOUT', label: 'Mundial 2026' },
  PL: { code: 'PL', type: 'LEAGUE', label: 'Premier League' },
};

const KNOCKOUT_STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

export async function fetchMatches(tournament) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY no configurada');
  }
  const config = TOURNAMENTS[tournament];
  if (!config) {
    throw new Error(`Torneo desconocido: ${tournament}`);
  }

  const res = await fetch(`https://api.football-data.org/v4/competitions/${config.code}/matches`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!res.ok) {
    throw new Error(`football-data.org respondió HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.matches || [];
}

const PENDING_MATCH_STATUSES = new Set(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED']);

// football-data.org's status field has been observed getting corrupted into a
// raw date string on individual matches instead of "FINISHED", even though
// the match has a complete final score. Trust any status we don't recognize
// as still-pending when the score is actually complete, rather than treating
// an already-decided match as still open and letting an eliminated team back
// into the pool.
function isMatchDecided(m) {
  if (PENDING_MATCH_STATUSES.has(m.status)) return false;
  if (m.status === 'FINISHED') return true;
  const ft = m.score && m.score.fullTime;
  return Boolean(ft && ft.home !== null && ft.home !== undefined && ft.away !== null && ft.away !== undefined);
}

// A "period" is the unit a game can start from: a bracket stage for
// KNOCKOUT tournaments (Fase de grupos, Cuartos de final, ...), or a
// matchday number for LEAGUE tournaments (round-robin, no bracket).
function periodOf(m, tournamentType) {
  return tournamentType === 'LEAGUE' ? m.matchday : m.stage;
}

export function getPeriods(matches, tournamentType) {
  if (tournamentType === 'KNOCKOUT') return KNOCKOUT_STAGE_ORDER;
  const matchdays = new Set();
  for (const m of matches) {
    if (typeof m.matchday === 'number') matchdays.add(m.matchday);
  }
  return [...matchdays].sort((a, b) => a - b);
}

// Only teams whose fixture at this period hasn't been decided yet are
// eligible for a fresh assignment: this guarantees no already-eliminated (or,
// for a league, already-played) team can be handed out, and no points can
// ever be retroactive to a match that already happened before the game
// existed.
export function teamsAtPeriod(matches, tournamentType, period) {
  const seen = new Map();
  for (const m of matches) {
    if (periodOf(m, tournamentType) !== period) continue;
    if (isMatchDecided(m)) continue;
    for (const side of [m.homeTeam, m.awayTeam]) {
      if (!side || !side.id || !side.name) continue;
      seen.set(side.id, { id: side.id, name: side.name, crest: side.crest || null });
    }
  }
  return [...seen.values()];
}

// Walks forward from the requested period until it finds one that still has
// teams with an undecided fixture. Returns null if nothing in the whole
// tournament is available yet (e.g. brackets/fixtures not published).
export function findAvailablePeriod(matches, tournamentType, requestedPeriod) {
  const periods = getPeriods(matches, tournamentType);
  const normalizedRequested = tournamentType === 'LEAGUE' ? Number(requestedPeriod) : requestedPeriod;
  const startIdx = periods.indexOf(normalizedRequested);
  if (startIdx === -1) return null;
  for (let i = startIdx; i < periods.length; i++) {
    const pool = teamsAtPeriod(matches, tournamentType, periods[i]);
    if (pool.length > 0) return { period: periods[i], pool };
  }
  return null;
}
