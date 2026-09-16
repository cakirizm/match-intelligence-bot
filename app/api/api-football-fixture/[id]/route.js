import {NextResponse} from 'next/server';
import {fixtureByIdAF,predictionAF,oddsAF,h2hAF,recentAF,injuriesAF,standingsAF,teamStatsAF} from '../../../../lib/api-football';
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
      predictionAF(id),
      oddsAF(id),
      recentAF(homeId,20),
      recentAF(awayId,20),
      h2hAF(homeId,awayId,10),
      injuriesAF(id),
      standingsAF(leagueId,season),
      teamStatsAF(leagueId,season,homeId),
      teamStatsAF(leagueId,season,awayId)
    ]);
    const [predictions,odds,recentHome,recentAway,h2h,injuries,standings,teamStatsHome,teamStatsAway]=results.map(val);
    const analysis=analyzeApiFootball({fixture,predictions,odds,recentHome,recentAway,h2h,injuries,standings,teamStatsHome,teamStatsAway});
    const names=['prediction','odds','recent-home','recent-away','h2h','injuries','standings','season-home','season-away'];
    const failed=names.filter((_,i)=>results[i].status==='rejected');
    const errors=results.map((r,i)=>r.status==='rejected'?{layer:names[i],message:String(r.reason?.message||r.reason).slice(0,180)}:null).filter(Boolean);
    return NextResponse.json({
      mode:'api-football',
      fixture:{id:fixture.fixture.id,starting_at:fixture.fixture.date,league:{name:fixture.league.name},name:`${fixture.teams.home.name} - ${fixture.teams.away.name}`},
      analysis,
      coverage:{failed,errors,successful:names.length-failed.length,total:names.length,requestsApprox:10}
    });
  }catch(error){return NextResponse.json({error:error.message},{status:500})}
}
