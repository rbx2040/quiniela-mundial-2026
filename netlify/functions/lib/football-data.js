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

export function teamsAtStage(matches, stage) {
  const seen = new Map();
  for (const m of matches) {
    if (m.stage !== stage) continue;
    for (const side of [m.homeTeam, m.awayTeam]) {
      if (!side || !side.id || !side.name) continue;
      seen.set(side.id, { id: side.id, name: side.name, crest: side.crest || null });
    }
  }
  return [...seen.values()];
}
