import { fetchMatches, findAvailablePeriod, TOURNAMENTS } from './lib/football-data.js';
import { buildMixedAssignment } from './lib/assignment.js';
import { generateUniqueSlug, saveGame } from './lib/games-store.js';

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

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'JSON inválido' });
  }

  const { gameName, creatorName, tournament, stage, players, adminPassword } = body || {};

  if (typeof gameName !== 'string' || !gameName.trim()) {
    return jsonResponse(400, { error: 'Falta el nombre de la quiniela' });
  }
  if (typeof creatorName !== 'string' || !creatorName.trim()) {
    return jsonResponse(400, { error: 'Falta tu nombre (el de quien crea la quiniela)' });
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
  if (typeof adminPassword !== 'string' || adminPassword.length < 4) {
    return jsonResponse(400, { error: 'La contraseña de administrador debe tener al menos 4 caracteres' });
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
  if (cleanPlayers.length > pool.length) {
    return jsonResponse(400, {
      error: `Solo hay ${pool.length} equipos disponibles en esa etapa para ${cleanPlayers.length} jugadores`,
    });
  }

  const assignedPlayers = buildMixedAssignment(pool, cleanPlayers);

  const slug = await generateUniqueSlug(gameName);
  const game = {
    slug,
    gameName: gameName.trim(),
    creatorName: creatorName.trim(),
    tournament,
    stage: resolved.period,
    createdAt: new Date().toISOString(),
    adminPassword,
    players: assignedPlayers,
    overrides: {},
  };

  await saveGame(slug, game);

  return jsonResponse(200, { slug });
};
