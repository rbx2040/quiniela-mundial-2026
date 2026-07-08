export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assigns players to a random subset of the pool. Every team in the pool gets
// an entry; teams beyond the number of players get name: null, rendered as
// "Sin Asignar" so they stay visible and can be claimed by a player added later.
export function buildAssignment(pool, playerNames) {
  const shuffledTeams = shuffle(pool);
  return shuffledTeams.map((team, i) => ({
    name: i < playerNames.length ? playerNames[i] : null,
    teamId: team.id,
    teamName: team.name,
    teamCrest: team.crest,
  }));
}
