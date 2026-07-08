import { fetchMatches, findAvailableStage, STAGE_ORDER } from './lib/football-data.js';

const VALID_TOURNAMENTS = ['WC2026'];

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

  const { tournament, stage } = body || {};
  if (!VALID_TOURNAMENTS.includes(tournament)) {
    return jsonResponse(400, { error: 'Torneo inválido' });
  }
  if (!STAGE_ORDER.includes(stage)) {
    return jsonResponse(400, { error: 'Etapa inválida' });
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

  return jsonResponse(200, {
    requestedStage: stage,
    resolvedStage: resolved.stage,
    pool: resolved.pool,
  });
};
