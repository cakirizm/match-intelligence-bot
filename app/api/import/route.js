import {NextResponse} from 'next/server';
import {fixturesByDateAF,hasApiFootballKey} from '../../../lib/api-football';
import {hasFootballDataToken,matchesByDateFD} from '../../../lib/football-data';
import {parseMatchLines,matchApiFootballLine,footballDataCrossCheck} from '../../../lib/match-import';

export const runtime='nodejs';
export const maxDuration=60;

function toItem(row,cross){
  const f=row.fixture;
  const home=f?.teams?.home?.name||row.home,away=f?.teams?.away?.name||row.away;
  return {
    fixture:{id:f?.fixture?.id,name:`${home} - ${away}`,starting_at:f?.fixture?.date,league:{name:f?.league?.name||'Lig'},source:'api-football'},
    analysis:{pending:true,status:'HAZIR',teams:{home,away},quality:cross?40:30,source:'api-football-match',bestPick:{label:'Detay analizi aç',prob:0,odd:null,market:null,edge:0},probabilities:{home:0,draw:0,away:0},odds:{home:null,draw:null,away:null}},
    importMeta:{raw:row.raw,matchScore:row.score,crossChecked:Boolean(cross),footballData:cross?{competition:cross.match?.competition?.name||null,id:cross.match?.id||null}:null}
  };
}

export async function POST(request){
  try{
    if(!hasApiFootballKey()) return NextResponse.json({error:'API_FOOTBALL_KEY tanımlı değil.'},{status:400});
    const body=await request.json();
    const date=body?.date||new Date().toISOString().slice(0,10),text=String(body?.text||'').trim();
    if(!text)return NextResponse.json({error:'Maç listesi boş.'},{status:400});
    const lines=parseMatchLines(text);
    const [af,fd]=await Promise.all([fixturesByDateAF(date),hasFootballDataToken()?matchesByDateFD(date):Promise.resolve([])]);
    const resolved=lines.map(line=>matchApiFootballLine(line,af));
    const matched=resolved.filter(x=>x.matched).map(row=>{const cross=footballDataCrossCheck(row,fd);return toItem(row,cross)});
    const unmatched=resolved.filter(x=>!x.matched).map(x=>({raw:x.raw,home:x.home||null,away:x.away||null,reason:x.error||'API-Football fikstüründe güvenilir eşleşme bulunamadı',score:Number(x.score||0)}));
    return NextResponse.json({mode:'import',date,source:'API-Football',requested:lines.length,matched:matched.length,unmatched:unmatched.length,fixtures:matched,unmatchedRows:unmatched,providerFixtures:af.length,footballDataChecked:fd.length});
  }catch(error){return NextResponse.json({error:error.message},{status:500})}
}
