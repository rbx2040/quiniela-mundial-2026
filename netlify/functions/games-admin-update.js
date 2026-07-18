import { fetchMatches, findAvailablePeriod, TOURNAMENTS } from './lib/football-data.js';
import { buildMixedAssignment } from './lib/assignment.js';
import { loadGame, saveGame } from './lib/games-store.js';

const STAGE_LABELS = {
  GROUP_STAGE: 'Fase de grupos', LAST_32: 'Dieciseisavos (1/16)', LAST_16: 'Octavos de final (1/8)',
  QUARTER_FINALS: 'Cuartos de final', SEMI_FINALS: 'Semifinales', FINAL: 'Final',
};

function periodLabel(tournamentType, period) {
  return tournamentType === 'LEAGUE' ? `Jornada ${period}` : (STAGE_LABELS[period] || period);
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  const configuredPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!configuredPassword) {
    return jsonResponse(500, { error: 'ADMIN_DASHBOARD_PASSWORD no configurada' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'JSON inválido' });
  }

  const { slug, sitePassword, gameName, creatorName, tournament, stage, players } = body || {};

  if (sitePassword !== configuredPassword) {
    return jsonResponse(401, { error: 'Contraseña de administrador del sitio incorrecta' });
  }
  if (typeof slug !== 'string' || !slug) {
    return jsonResponse(400, { error: 'Falta el slug' });
  }

  const existing = await loadGame(slug);
  if (!existing) {
    return jsonResponse(404, { error: 'Quiniela no encontrada' });
  }

  if (typeof gameName !== 'string' || !gameName.trim()) {
    return jsonResponse(400, { error: 'Falta el nombre de la quiniela' });
  }
  if (typeof creatorName !== 'string' || !creatorName.trim()) {
    return jsonResponse(400, { error: 'Falta el nombre del creador' });
  }
  const tournamentConfig = TOURNAMENTS[tournament];
  if (!tournamentConfig) {
    return jsonResponse(400, { error: 'Torneo inválido' });
  }
  if (stage === undefined || stage === null || stage === '') {
    return jsonResponse(400, { error: 'Etapa inválida' });
  }
  if (tournamentConfig.type === 'LEAGUE' && (!Number.isInteger(Number(stage)) || Number(stage) < 1)) {
    return jsonResponse(400, { error: 'La jornada debe ser un número' });
  }
  if (!Array.isArray(players) || players.length < 2) {
    return jsonResponse(400, { error: 'Se necesitan al menos 2 jugadores' });
  }
  // Each entry is either a plain name (auto-assigned) or { name, teamId }
  // (manually pinned to a specific team).
  const normalizedPlayers = [];
  for (const p of players) {
    let name, teamId;
    if (typeof p === 'string') {
      name = p.trim();
    } else if (p && typeof p === 'object') {
      name = typeof p.name === 'string' ? p.name.trim() : '';
      teamId = p.teamId === undefined || p.teamId === null || p.teamId === '' ? null : Number(p.teamId);
    } else {
      return jsonResponse(400, { error: 'Formato de jugador inválido' });
    }
    if (!name) return jsonResponse(400, { error: 'Todos los jugadores necesitan un nombre' });
    normalizedPlayers.push(teamId ? { name, teamId } : name);
  }
  if (normalizedPlayers.length > 48) {
    return jsonResponse(400, { error: 'Demasiados jugadores' });
  }

  let matches;
  try {
    matches = await fetchMatches(tournament);
  } catch (err) {
    return jsonResponse(502, { error: `No se pudo consultar football-data.org: ${err.message}` });
  }

  const resolved = findAvailablePeriod(matches, tournamentConfig.type, stage);
  if (!resolved) {
    return jsonResponse(400, { error: 'Ese torneo todavía no tiene equipos disponibles para ninguna etapa.' });
  }
  if (resolved.period !== stage && String(resolved.period) !== String(stage)) {
    return jsonResponse(409, {
      error: `${periodLabel(tournamentConfig.type, stage)} ya concluyó. La próxima etapa disponible es ${periodLabel(tournamentConfig.type, resolved.period)}.`,
      suggestedStage: resolved.period,
    });
  }

  const pool = resolved.pool;
  if (normalizedPlayers.length > pool.length) {
    return jsonResponse(400, {
      error: `Solo hay ${pool.length} equipos disponibles en esa etapa para ${normalizedPlayers.length} jugadores`,
    });
  }

  let assignedPlayers;
  try {
    assignedPlayers = buildMixedAssignment(pool, normalizedPlayers);
  } catch (err) {
    return jsonResponse(400, { error: err.message });
  }

  const updatedGame = {
    ...existing,
    gameName: gameName.trim(),
    creatorName: creatorName.trim(),
    tournament,
    stage: resolved.period,
    players: assignedPlayers,
    overrides: {},
  };

  await saveGame(slug, updatedGame);

  return jsonResponse(200, { slug });
};
