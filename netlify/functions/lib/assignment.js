export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assigns players to teams from the pool. Each entry in playerEntries is
// either a plain name string (auto-assigned a random team from whatever's
// left) or a { name, teamId } object pinning that player to a specific team.
// Every team in the pool gets an entry either way; teams claimed by nobody
// get name: null, rendered as "Sin Asignar" so they stay visible and can be
// claimed by a player added later.
export function buildMixedAssignment(pool, playerEntries) {
  const poolById = new Map(pool.map((t) => [t.id, t]));
  const manual = [];
  const autoNames = [];
  const usedTeamIds = new Set();

  for (const entry of playerEntries) {
    if (typeof entry === 'string') {
      autoNames.push(entry);
      continue;
    }
    const name = entry?.name ?? '';
    if (entry?.teamId === undefined || entry?.teamId === null) {
      autoNames.push(name);
      continue;
    }
    const team = poolById.get(entry.teamId);
    if (!team) {
      throw new Error(`El equipo elegido para ${name} ya no está disponible en esta etapa.`);
    }
    if (usedTeamIds.has(entry.teamId)) {
      throw new Error(`No puedes asignar el equipo ${team.name} a más de un jugador.`);
    }
    usedTeamIds.add(entry.teamId);
    manual.push({ name, teamId: team.id, teamName: team.name, teamCrest: team.crest });
  }

  const remainingPool = pool.filter((t) => !usedTeamIds.has(t.id));
  if (autoNames.length > remainingPool.length) {
    throw new Error(`Solo quedan ${remainingPool.length} equipos disponibles para ${autoNames.length} jugadores sin equipo fijo.`);
  }

  const shuffledRemaining = shuffle(remainingPool);
  const autoAssigned = autoNames.map((name, i) => ({
    name,
    teamId: shuffledRemaining[i].id,
    teamName: shuffledRemaining[i].name,
    teamCrest: shuffledRemaining[i].crest,
  }));

  const claimedIds = new Set([...usedTeamIds, ...autoAssigned.map((a) => a.teamId)]);
  const unassigned = pool
    .filter((t) => !claimedIds.has(t.id))
    .map((t) => ({ name: null, teamId: t.id, teamName: t.name, teamCrest: t.crest }));

  return [...manual, ...autoAssigned, ...unassigned];
}
