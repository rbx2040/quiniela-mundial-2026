const COMPETITION_CODES = {
  WC2026: 'WC',
};

export async function fetchMatches(tournament) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY no configurada');
  }
  const competitionCode = COMPETITION_CODES[tournament];
  if (!competitionCode) {
    throw new Error(`Torneo desconocido: ${tournament}`);
  }

  const res = await fetch(`https://api.football-data.org/v4/competitions/${competitionCode}/matches`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!res.ok) {
    throw new Error(`football-data.org respondió HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.matches || [];
}

export const STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

// Only teams whose fixture at this stage hasn't been decided yet are eligible
// for a fresh assignment: this guarantees no already-eliminated team can be
// handed out, and no points can ever be retroactive to a match that already
// happened before the game existed.
export function teamsAtStage(matches, stage) {
  const seen = new Map();
  for (const m of matches) {
    if (m.stage !== stage) continue;
    if (m.status === 'FINISHED') continue;
    for (const side of [m.homeTeam, m.awayTeam]) {
      if (!side || !side.id || !side.name) continue;
      seen.set(side.id, { id: side.id, name: side.name, crest: side.crest || null });
    }
  }
  return [...seen.values()];
}

// Walks forward from the requested stage until it finds one that still has
// teams with an undecided fixture. Returns null if nothing in the whole
// tournament is available yet (e.g. brackets not published).
export function findAvailableStage(matches, requestedStage) {
  const startIdx = STAGE_ORDER.indexOf(requestedStage);
  if (startIdx === -1) return null;
  for (let i = startIdx; i < STAGE_ORDER.length; i++) {
    const pool = teamsAtStage(matches, STAGE_ORDER[i]);
    if (pool.length > 0) return { stage: STAGE_ORDER[i], pool };
  }
  return null;
}
