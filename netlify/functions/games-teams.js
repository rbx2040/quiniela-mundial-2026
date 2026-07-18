import { fetchMatches, findAvailablePeriod, TOURNAMENTS } from './lib/football-data.js';

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
  const tournamentConfig = TOURNAMENTS[tournament];
  if (!tournamentConfig) {
    return jsonResponse(400, { error: 'Torneo inválido' });
  }
  if (stage === undefined || stage === null || stage === '') {
    return jsonResponse(400, { error: 'Etapa inválida' });
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

  return jsonResponse(200, {
    requestedStage: stage,
    resolvedStage: resolved.period,
    pool: resolved.pool,
  });
};
