export default async () => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY no configurada' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': apiKey },
  });
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
