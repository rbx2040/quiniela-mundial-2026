import { getStore } from '@netlify/blobs';

const STORE_NAME = 'quiniela-games';

function getGamesStore() {
  return getStore(STORE_NAME);
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'quiniela';
}

export async function slugExists(slug) {
  const store = getGamesStore();
  const existing = await store.get(slug, { type: 'json' });
  return existing !== null;
}

export async function generateUniqueSlug(gameName) {
  const base = slugify(gameName);
  let candidate = base;
  let attempt = 0;
  while (await slugExists(candidate)) {
    attempt++;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${base}-${suffix}`;
    if (attempt > 10) throw new Error('No se pudo generar un slug único');
  }
  return candidate;
}

export async function saveGame(slug, game) {
  const store = getGamesStore();
  await store.setJSON(slug, game);
}

export async function loadGame(slug) {
  const store = getGamesStore();
  return store.get(slug, { type: 'json' });
}
