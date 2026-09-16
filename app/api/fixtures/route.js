import { NextResponse } from 'next/server';
import { fixturesByDate, hasToken } from '../../../lib/sportmonks';
import { analyzeFixture } from '../../../lib/analysis';
import { demoFixtures } from '../../../lib/demo';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  try {
    const raw = hasToken() ? await fixturesByDate(date) : demoFixtures;
    const fixtures = raw.map((fixture) => ({ fixture, analysis: analyzeFixture(fixture) }));
    return NextResponse.json({
      mode: hasToken() ? 'live' : 'demo',
      date,
      count: fixtures.length,
      fixtures,
      warning: hasToken() ? null : 'SPORTMONKS_API_TOKEN yok: demo verisi gösteriliyor.'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
