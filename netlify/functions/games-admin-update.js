import { fetchMatches, findAvailableStage, STAGE_ORDER } from './lib/football-data.js';
import { buildAssignment } from './lib/assignment.js';
import { loadGame, saveGame } from './lib/games-store.js';

const VALID_TOURNAMENTS = ['WC2026'];
const STAGE_LABELS = {
  GROUP_STAGE: 'Fase de grupos', LAST_32: 'Dieciseisavos (1/16)', LAST_16: 'Octavos de final (1/8)',
  QUARTER_FINALS: 'Cuartos de final', SEMI_FINALS: 'Semifinales', FINAL: 'Final',
};

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
  if (!VALID_TOURNAMENTS.includes(tournament)) {
    return jsonResponse(400, { error: 'Torneo inválido' });
  }
  if (!STAGE_ORDER.includes(stage)) {
    return jsonResponse(400, { error: 'Etapa inválida' });
  }
  if (!Array.isArray(players) || players.length < 2) {
    return jsonResponse(400, { error: 'Se necesitan al menos 2 jugadores' });
  }
  const cleanPlayers = players.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
  if (cleanPlayers.length !== players.length) {
    return jsonResponse(400, { error: 'Todos los jugadores necesitan un nombre' });
  }
  if (cleanPlayers.length > 48) {
    return jsonResponse(400, { error: 'Demasiados jugadores' });
  }

  let matches;
  try {
    matches = await fetchMatches(tournament);
  } catch (err) {
    return jsonResponse(502, { error: `No se pudo consultar football-data.org: ${err.message}` });
  }

  const resolved = findAvailableStage(matches, stage);
  if (!resolved) {
    return jsonResponse(400, { error: 'Ese torneo todavía no tiene equipos disponibles para ninguna etapa.' });
  }
  if (resolved.stage !== stage) {
    return jsonResponse(409, {
      error: `${STAGE_LABELS[stage]} ya concluyó. La próxima etapa disponible es ${STAGE_LABELS[resolved.stage]}.`,
      suggestedStage: resolved.stage,
    });
  }

  const pool = resolved.pool;
  if (cleanPlayers.length > pool.length) {
    return jsonResponse(400, {
      error: `Solo hay ${pool.length} equipos disponibles en esa etapa para ${cleanPlayers.length} jugadores`,
    });
  }

  const assignedPlayers = buildAssignment(pool, cleanPlayers);

  const updatedGame = {
    ...existing,
    gameName: gameName.trim(),
    creatorName: creatorName.trim(),
    tournament,
    stage,
    players: assignedPlayers,
    overrides: {},
  };

  await saveGame(slug, updatedGame);

  return jsonResponse(200, { slug });
};
