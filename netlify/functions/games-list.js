import { listGames } from './lib/games-store.js';

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

  if (body?.password !== configuredPassword) {
    return jsonResponse(401, { error: 'Contraseña incorrecta' });
  }

  const games = await listGames();
  const summaries = games
    .map((g) => {
      const base = {
        slug: g.slug,
        gameName: g.gameName,
        creatorName: g.creatorName || '(sin nombre)',
        tournament: g.tournament,
        mode: g.mode || 'TEAM_POOL',
        createdAt: g.createdAt,
      };
      if (base.mode === 'MATCH_PREDICTIONS') {
        const playerNames = Object.keys(g.predictions || {});
        return {
          ...base,
          assignedCount: playerNames.length,
          totalSlots: playerNames.length,
          players: playerNames.map((name) => ({ name })),
        };
      }
      return {
        ...base,
        stage: g.stage,
        assignedCount: (g.players || []).filter((p) => p.name).length,
        totalSlots: g.players?.length || 0,
        players: (g.players || []).map((p) => ({
          name: p.name,
          teamId: p.teamId,
          teamName: p.teamName,
          teamCrest: p.teamCrest,
        })),
      };
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return jsonResponse(200, { games: summaries });
};
