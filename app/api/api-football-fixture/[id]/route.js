import {NextResponse} from 'next/server';
import {fixtureByIdAF,predictionAF,oddsAF,h2hAF,recentAF,injuriesAF,standingsAF} from '../../../../lib/api-football';
import {analyzeApiFootball} from '../../../../lib/api-football-analysis';

export const runtime='nodejs';
export const maxDuration=60;
const val=r=>r.status==='fulfilled'?r.value:[];

export async function GET(_request,{params}){
  try{
    const {id}=await params;
    const fixtureRows=await fixtureByIdAF(id),fixture=fixtureRows?.[0];
    if(!fixture)return NextResponse.json({error:'Maç API-Football üzerinde bulunamadı.'},{status:404});
    const homeId=fixture?.teams?.home?.id,awayId=fixture?.teams?.away?.id,leagueId=fixture?.league?.id,season=fixture?.league?.season;
    const results=await Promise.allSettled([
      predictionAF(id),oddsAF(id),recentAF(homeId,10),recentAF(awayId,10),h2hAF(homeId,awayId,10),injuriesAF(id),standingsAF(leagueId,season)
    ]);
    const [predictions,odds,recentHome,recentAway,h2h,injuries,standings]=results.map(val);
    const analysis=analyzeApiFootball({fixture,predictions,odds,recentHome,recentAway,h2h,injuries,standings});
    const failed=['prediction','odds','recent-home','recent-away','h2h','injuries','standings'].filter((_,i)=>results[i].status==='rejected');
    return NextResponse.json({mode:'api-football',fixture:{id:fixture.fixture.id,starting_at:fixture.fixture.date,league:{name:fixture.league.name},name:`${fixture.teams.home.name} - ${fixture.teams.away.name}`},analysis,coverage:{failed,successful:7-failed.length,requestsApprox:8}});
  }catch(error){return NextResponse.json({error:error.message},{status:500})}
}
