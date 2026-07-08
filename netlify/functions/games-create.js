import { fetchMatches, teamsAtStage } from './lib/football-data.js';
import { generateUniqueSlug, saveGame } from './lib/games-store.js';

const VALID_STAGES = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
const VALID_TOURNAMENTS = ['WC2026'];

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  if (!VALID_TOURNAMENTS.includes(tournament)) {
    return jsonResponse(400, { error: 'Torneo inválido' });
  }
  if (!VALID_STAGES.includes(stage)) {
    return jsonResponse(400, { error: 'Etapa inválida' });
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

  const pool = teamsAtStage(matches, stage);
  if (cleanPlayers.length > pool.length) {
    return jsonResponse(400, {
      error: `Solo hay ${pool.length} equipos disponibles en esa etapa para ${cleanPlayers.length} jugadores`,
    });
  }

  const shuffledTeams = shuffle(pool).slice(0, cleanPlayers.length);
  const assignedPlayers = cleanPlayers.map((name, i) => ({
    name,
    teamId: shuffledTeams[i].id,
    teamName: shuffledTeams[i].name,
    teamCrest: shuffledTeams[i].crest,
  }));

  const slug = await generateUniqueSlug(gameName);
  const game = {
    slug,
    gameName: gameName.trim(),
    creatorName: creatorName.trim(),
    tournament,
    stage,
    createdAt: new Date().toISOString(),
    adminPassword,
    players: assignedPlayers,
    overrides: {},
  };

  await saveGame(slug, game);

  return jsonResponse(200, { slug });
};
