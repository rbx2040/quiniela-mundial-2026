const PENDING_MATCH_STATUSES = new Set(['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED']);

export const MAX_CHIPS = 2;

// See football-data.js for why this trusts a complete score over an
// unrecognized status string instead of treating a decided match as pending.
export function isMatchDecided(m) {
  if (PENDING_MATCH_STATUSES.has(m.status)) return false;
  if (m.status === 'FINISHED') return true;
  const ft = m.score && m.score.fullTime;
  return Boolean(ft && ft.home !== null && ft.home !== undefined && ft.away !== null && ft.away !== undefined);
}

// A match stops accepting new picks the moment it kicks off, regardless of
// what the (sometimes-stale) status field says.
export function isMatchOpen(m, now = new Date()) {
  if (!m.utcDate) return false;
  return new Date(m.utcDate).getTime() > now.getTime();
}

export function actualScore(m) {
  const ft = m.score && m.score.fullTime;
  if (!ft || ft.home === null || ft.home === undefined || ft.away === null || ft.away === undefined) return null;
  return { home: ft.home, away: ft.away };
}

export function outcomeOf(home, away) {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function hasPick(pred) {
  return Boolean(pred) && Number.isInteger(pred.home) && Number.isInteger(pred.away) && pred.home >= 0 && pred.away >= 0;
}

// Scoring: 3 pts for the right outcome (win/draw/loss), 1 pt for a wrong
// outcome that was still close (predicted home or away goals within 1 of the
// real number), 0 otherwise. A played chip adds +1 on top when the exact
// scoreline was called.
export function scorePrediction(pred, match) {
  if (!hasPick(pred)) return { points: 0, tier: 'none', exact: false };
  if (!isMatchDecided(match)) return { points: 0, tier: 'pending', exact: false };
  const actual = actualScore(match);
  if (!actual) return { points: 0, tier: 'pending', exact: false };

  const predOutcome = outcomeOf(pred.home, pred.away);
  const actualOutcome = outcomeOf(actual.home, actual.away);
  const exact = pred.home === actual.home && pred.away === actual.away;

  let points = 0;
  let tier = 'wrong';
  if (predOutcome === actualOutcome) {
    points = 3;
    tier = 'correct';
  } else if (Math.abs(pred.home - actual.home) <= 1 || Math.abs(pred.away - actual.away) <= 1) {
    points = 1;
    tier = 'close';
  }
  if (pred.chip && exact) points += 1;

  return { points, tier, exact };
}

// Totals one player's picks against the live match list. `picks` is keyed by
// match id (string or number) -> { home, away, chip }.
export function scorePlayerPredictions(picks, matches) {
  const byId = new Map(matches.map((m) => [String(m.id), m]));
  let total = 0;
  let chipsUsed = 0;
  const perMatch = {};
  for (const [matchId, pred] of Object.entries(picks || {})) {
    if (pred && pred.chip) chipsUsed++;
    const match = byId.get(String(matchId));
    if (!match) continue;
    const result = scorePrediction(pred, match);
    perMatch[matchId] = result;
    total += result.points;
  }
  return { total, chipsUsed, perMatch };
}
