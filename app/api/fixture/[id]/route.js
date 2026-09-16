import { NextResponse } from 'next/server';
import { fixtureDetail, h2h, recentTeamFixtures, hasToken } from '../../../../lib/sportmonks';
import { analyzeFixture, getTeams } from '../../../../lib/analysis';
import { demoFixtures } from '../../../../lib/demo';

function dateShift(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    let fixture;
    let context = { h2h: [], homeRecent: [], awayRecent: [] };
    if (!hasToken()) {
      fixture = demoFixtures.find((f) => String(f.id) === String(id)) || demoFixtures[0];
    } else {
      fixture = await fixtureDetail(id);
      const { home, away } = getTeams(fixture);
      if (home?.id && away?.id) {
        const [head, hr, ar] = await Promise.allSettled([
          h2h(home.id, away.id),
          recentTeamFixtures(home.id, dateShift(-95), dateShift(0)),
          recentTeamFixtures(away.id, dateShift(-95), dateShift(0))
        ]);
        context = {
          h2h: head.status === 'fulfilled' ? head.value : [],
          homeRecent: hr.status === 'fulfilled' ? hr.value : [],
          awayRecent: ar.status === 'fulfilled' ? ar.value : []
        };
      }
    }
    return NextResponse.json({ mode: hasToken() ? 'live' : 'demo', fixture, context, analysis: analyzeFixture(fixture, context) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
