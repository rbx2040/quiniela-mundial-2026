import { fetchMatches } from './lib/football-data.js';
import { isMatchOpen, MAX_CHIPS } from './lib/predictions.js';
import { loadGame, saveGame } from './lib/games-store.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidPick(pick) {
  return pick && Number.isInteger(pick.home) && Number.isInteger(pick.away)
    && pick.home >= 0 && pick.home <= 20 && pick.away >= 0 && pick.away <= 20;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'JSON inválido' });
  }

  const { slug, playerName, picks } = body || {};
  if (typeof slug !== 'string' || !slug) {
    return jsonResponse(400, { error: 'Falta el slug' });
  }
  const name = typeof playerName === 'string' ? playerName.trim() : '';
  if (!name) {
    return jsonResponse(400, { error: 'Falta tu nombre' });
  }
  if (name.length > 40) {
    return jsonResponse(400, { error: 'El nombre es demasiado largo' });
  }
  if (picks !== undefined && (typeof picks !== 'object' || picks === null || Array.isArray(picks))) {
    return jsonResponse(400, { error: 'Formato de predicciones inválido' });
  }

  const game = await loadGame(slug);
  if (!game) {
    return jsonResponse(404, { error: 'Quiniela no encontrada' });
  }
  if (game.mode !== 'MATCH_PREDICTIONS') {
    return jsonResponse(400, { error: 'Esta quiniela no usa el modo de predicciones' });
  }

  let matches;
  try {
    matches = await fetchMatches(game.tournament);
  } catch (err) {
    return jsonResponse(502, { error: `No se pudo consultar football-data.org: ${err.message}` });
  }
  const matchesById = new Map(matches.map((m) => [String(m.id), m]));

  const existing = (game.predictions && game.predictions[name]) || {};
  const merged = { ...existing };

  // Only matches still open (before kickoff) can be written; anything the
  // client sends for an already-locked match is silently ignored so the
  // server stays the source of truth on what a player actually locked in.
  for (const [matchId, pick] of Object.entries(picks || {})) {
    const match = matchesById.get(String(matchId));
    if (!match || !isMatchOpen(match)) continue;
    if (!isValidPick(pick)) {
      return jsonResponse(400, { error: `Predicción inválida para el partido ${matchId}` });
    }
    merged[matchId] = { home: pick.home, away: pick.away, chip: Boolean(pick.chip) };
  }

  const chipsUsed = Object.values(merged).filter((p) => p.chip).length;
  if (chipsUsed > MAX_CHIPS) {
    return jsonResponse(400, { error: `Solo puedes usar el chip ${MAX_CHIPS} veces en toda la temporada.` });
  }

  game.predictions = { ...(game.predictions || {}), [name]: merged };
  await saveGame(slug, game);

  return jsonResponse(200, { picks: merged });
};
