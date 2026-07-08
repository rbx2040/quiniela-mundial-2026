import { getStore } from '@netlify/blobs';

const STORE_NAME = 'quiniela-games';

function getGamesStore() {
  return getStore(STORE_NAME);
}

// Netlify's default edge-access reads are only eventually consistent (their
// docs cite drift of up to 60s), which is how a game fetched right after
// creation can come back "not found". `consistency: 'strong'` fixes that, but
// it throws BlobsConsistencyError if the environment wasn't configured with
// an uncachedEdgeURL - so fall back to a normal (eventual) read rather than
// hard-failing every request if that ever happens.
async function strongGet(slug) {
  try {
    const store = getStore(STORE_NAME, { consistency: 'strong' });
    return await store.get(slug, { type: 'json' });
  } catch (err) {
    if (err?.name === 'BlobsConsistencyError') {
      return getGamesStore().get(slug, { type: 'json' });
    }
    throw err;
  }
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
  const existing = await strongGet(slug);
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
  return strongGet(slug);
}

export async function deleteGame(slug) {
  const store = getGamesStore();
  await store.delete(slug);
}

export async function listGames() {
  const store = getGamesStore();
  const { blobs } = await store.list();
  const games = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  return games.filter(Boolean);
}
