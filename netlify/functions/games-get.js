import { fetchMatches } from './lib/football-data.js';
import { loadGame } from './lib/games-store.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return jsonResponse(400, { error: 'Falta el parámetro slug' });
  }

  const game = await loadGame(slug);
  if (!game) {
    return jsonResponse(404, { error: 'Quiniela no encontrada' });
  }

  const { adminPassword, ...publicGame } = game;

  let matches = [];
  let matchesError = null;
  try {
    matches = await fetchMatches(game.tournament);
  } catch (err) {
    matchesError = err.message;
  }

  return jsonResponse(200, { game: publicGame, matches, matchesError });
};
