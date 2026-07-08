import { loadGame, saveGame } from './lib/games-store.js';

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

  const { slug, adminPassword, teamId, points, eliminated } = body || {};
  if (typeof slug !== 'string' || !slug) {
    return jsonResponse(400, { error: 'Falta el slug' });
  }
  if (!teamId) {
    return jsonResponse(400, { error: 'Falta el equipo a ajustar' });
  }

  const game = await loadGame(slug);
  if (!game) {
    return jsonResponse(404, { error: 'Quiniela no encontrada' });
  }
  if (adminPassword !== game.adminPassword) {
    return jsonResponse(401, { error: 'Contraseña de administrador incorrecta' });
  }

  const overrides = game.overrides || {};
  const key = String(teamId);
  const next = { ...(overrides[key] || {}) };

  if (points === null || points === undefined || points === '') {
    delete next.points;
  } else {
    next.points = Number(points);
  }

  if (eliminated === 'yes' || eliminated === 'no') {
    next.elim = eliminated;
  } else {
    delete next.elim;
  }

  if (Object.keys(next).length === 0) {
    delete overrides[key];
  } else {
    overrides[key] = next;
  }
  game.overrides = overrides;

  await saveGame(slug, game);

  return jsonResponse(200, { overrides: game.overrides });
};
