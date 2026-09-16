const BASE = 'https://api.sportmonks.com/v3/football';

function token() {
  return process.env.SPORTMONKS_API_TOKEN;
}

export function hasToken() {
  return Boolean(token());
}

async function request(path, params = {}) {
  const apiToken = token();
  if (!apiToken) throw new Error('SPORTMONKS_API_TOKEN tanımlı değil.');

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_token', apiToken);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sportmonks ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function fixturesByDate(date, timezone = 'Asia/Dubai') {
  const all = [];
  let page = 1;
  let hasMore = true;
  const includes = 'league;participants;odds;predictions';

  while (hasMore) {
    const json = await request(`/fixtures/date/${date}`, {
      include: includes,
      timezone,
      per_page: 50,
      page,
      order: 'asc'
    });

    all.push(...(json.data || []));
    hasMore = Boolean(json.pagination?.has_more);

    if (!hasMore) break;

    const currentPage = Number(json.pagination?.current_page || page);
    const nextPage = currentPage + 1;
    if (nextPage <= page) throw new Error('Sportmonks pagination ilerlemiyor; sonsuz döngü engellendi.');
    page = nextPage;

    if (page > 500) throw new Error('Beklenmeyen pagination sınırı (>25.000 maç/gün).');
  }
  return all;
}

export async function fixtureDetail(id) {
  return (await request(`/fixtures/${id}`, {
    include: 'league;participants;odds;premiumOdds;predictions;sidelined;expectedLineups;prematchNews;xGFixture;weatherReport;venue'
  })).data;
}

export async function h2h(teamA, teamB) {
  const json = await request(`/fixtures/head-to-head/${teamA}/${teamB}`, {
    include: 'participants;scores;league',
    per_page: 25
  });
  return json.data || [];
}

export async function recentTeamFixtures(teamId, startDate, endDate) {
  const json = await request(`/fixtures/between/${startDate}/${endDate}/${teamId}`, {
    include: 'participants;scores;league;xGFixture',
    per_page: 50,
    order: 'desc'
  });
  return json.data || [];
}
