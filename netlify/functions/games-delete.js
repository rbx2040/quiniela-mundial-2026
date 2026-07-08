import { loadGame, deleteGame } from './lib/games-store.js';

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

  const { slug, sitePassword } = body || {};
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

  await deleteGame(slug);

  return jsonResponse(200, { slug });
};
