// SIMULAB Fixtures V4.1 — free authorised/public data sources.
// Full 2026/27: OpenFootball CC0 for PL/La Liga/Serie A/Ligue 1;
// OpenLigaDB ODbL for Bundesliga and UEFA Champions League.
// TheSportsDB V1 free key 123 augments recent fixtures/scores (limited).
// Source attribution and freshness are surfaced; no paid API or user key required.
const SETUP={
 eng:{open:"en",sportsdb:4328,name:"Premier League"},
 esp:{open:"es",sportsdb:4335,name:"La Liga"},
 ger:{open:"de",openliga:"bl1",sportsdb:4331,name:"Bundesliga"},
 ita:{open:"it",sportsdb:4332,name:"Serie A"},
 fra:{open:"fr",sportsdb:4334,name:"Ligue 1"},
 ucl:{openliga:"ucl",sportsdb:4480,name:"UEFA Champions League"}
};
const TODAY=()=>new Date().toISOString().slice(0,10);
const DATE=s=>/^\d{4}-\d\d-\d\d$/.test(String(s||""))&&!Number.isNaN(Date.parse(s));
const integer=x=>x!==null&&x!==undefined&&String(x)!==""&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=30?Number(x):null;
const failText=e=>String(e?.message||e).slice(0,140);
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|afc|club|calcio|ac|sc)\b/g,"").replace(/[^a-z0-9]/g,"");
async function getJSON(url,limit=14000){
 const aborter=new AbortController(),timer=setTimeout(()=>aborter.abort(),limit);
 try{
  const r=await fetch(url,{signal:aborter.signal,headers:{"Accept":"application/json","User-Agent":"SIMULAB/4.1 (public football analytics)"}});
  if(!r.ok)throw Error("HTTP "+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
}
function normal({date,home,away,hg,ag,kickoff,time,source,round,eventId}){
 const d=String(date||"").slice(0,10),a=String(home||"").trim(),b=String(away||"").trim();
 if(!DATE(d)||!a||!b||a===b)return null;
 const k=typeof kickoff==="string"&&/^\d{4}-\d\d-\d\dT/.test(kickoff)?kickoff:null;
 const base={date:d,home:a.slice(0,90),away:b.slice(0,90),time:String(time||"").slice(0,5),kickoff:k,round:round??null,
  eventId:eventId?String(eventId):null,source,season:"2026-27"};
 if(d<=TODAY()&&integer(hg)!==null&&integer(ag)!==null)return {...base,hg:integer(hg),ag:integer(ag),isResult:true};
 if(d>=TODAY())return {...base,isResult:false};
 return null;
}
function openFootballGame(m){
 const ft=Array.isArray(m.score)?m.score:m.score?.ft;
 const date=String(m.date||"").slice(0,10);
 return normal({date,home:m.team1,away:m.team2,
  hg:Array.isArray(ft)?ft[0]:null,ag:Array.isArray(ft)?ft[1]:null,
  time:m.time||"",source:"OpenFootball CC0",round:m.round||null});
}
async function openFootball(code){
 const url="https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/"+code+".1.json";
 const j=await getJSON(url);
 if(!Array.isArray(j.matches))throw Error("OpenFootball fixture list missing");
 return {rows:j.matches.map(openFootballGame).filter(Boolean),source:"OpenFootball CC0",link:"https://github.com/openfootball/football.json",
  licence:"CC0-1.0"};
}
function openLigaGame(m){
 const result=(m.matchResults||[]).find(r=>r.resultTypeID===2||r.resultTypeKind==="Endresult"||r.resultName==="Endergebnis");
 const iso=String(m.matchDateTimeUTC||m.matchDateTime||"");
 const d=iso.slice(0,10);
 return normal({date:d,home:m.team1?.teamName,away:m.team2?.teamName,
  hg:m.matchIsFinished?result?.pointsTeam1:null,ag:m.matchIsFinished?result?.pointsTeam2:null,
  kickoff:/^\d{4}-\d\d-\d\dT/.test(iso)&&m.matchDateTimeUTC?iso+"Z".replace("ZZ","Z"):null,
  time:iso.slice(11,16),source:"OpenLigaDB ODbL",round:m.group?.groupName||null,eventId:m.matchID});
}
async function openLiga(shortcut){
 const url="https://api.openligadb.de/getmatchdata/"+shortcut+"/2026";
 const j=await getJSON(url);
 if(!Array.isArray(j)||!j.length)throw Error("OpenLigaDB league unavailable");
 return {rows:j.map(openLigaGame).filter(Boolean),source:"OpenLigaDB ODbL",link:"https://www.openligadb.de",licence:"ODbL-1.0"};
}
function sportsDBGame(m){
 const date=String(m.dateEvent||"").slice(0,10),kickoff=String(m.strTimestamp||"");
 return normal({date,home:m.strHomeTeam,away:m.strAwayTeam,hg:m.intHomeScore,ag:m.intAwayScore,
  kickoff:/^\d{4}-\d\d-\d\dT/.test(kickoff)?kickoff:null,
  time:m.strTime||"",source:"TheSportsDB Free API",round:m.intRound||null,eventId:m.idEvent});
}
async function sportsDB(id){
 const base="https://www.thesportsdb.com/api/v1/json/123/";
 const commands=["eventsseason.php?id="+id+"&s=2026-2027","eventsnextleague.php?id="+id,"eventspastleague.php?id="+id];
 const loads=await Promise.allSettled(commands.map(q=>getJSON(base+q,11500)));
 const rows=[],errors=[];
 for(let i=0;i<loads.length;i++){
  const r=loads[i];
  if(r.status==="fulfilled"&&Array.isArray(r.value.events))rows.push(...r.value.events.map(sportsDBGame).filter(Boolean));
  else if(r.status==="rejected")errors.push(commands[i].split("?")[0]+": "+failText(r.reason));
 }
 if(!rows.length)throw Error("No records from TheSportsDB free tier "+errors.join("; "));
 return {rows,source:"TheSportsDB Free API",link:"https://www.thesportsdb.com/docs_api_guide.php",
  licence:"Provider API conditions apply",warning:"Free plan returns a restricted subset of season / latest events."};
}
function merge(parts){
 const result=new Map(),scheduled=new Map(),scores=[];
 const rank=row=>row.source==="OpenLigaDB ODbL"?4:row.source==="TheSportsDB Free API"?3:row.source==="OpenFootball CC0"?2:1;
 const key=x=>[x.date,norm(x.home),norm(x.away)].join("|");
 for(const p of parts)for(const row of p.rows){
  if(row.isResult){
   const k=key(row),old=result.get(k);
   if(!old||rank(row)>=rank(old))result.set(k,row);
  }else if(row.date>=TODAY()){
   const k=key(row),old=scheduled.get(k);
   if(!old||rank(row)>=rank(old))scheduled.set(k,row);
  }
 }
 for(const [k] of result)scheduled.delete(k);
 const sort=(a,b)=>(a.kickoff||a.date+"T"+(a.time||"00:00")).localeCompare(b.kickoff||b.date+"T"+(b.time||"00:00"));
 return {completed:[...result.values()].sort(sort),upcoming:[...scheduled.values()].sort(sort)};
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const league=String(req.query?.league||"");
 const cfg=SETUP[league];
 if(!cfg)return res.status(400).json({error:"Unknown competition"});
 const sources=[],failed=[];
 let fullSeason=false;
 try{
  const baseResult=cfg.openliga?await openLiga(cfg.openliga):await openFootball(cfg.open);
  sources.push(baseResult);fullSeason=true;
 }catch(e){
  failed.push((cfg.openliga?"OpenLigaDB":"OpenFootball")+": "+failText(e));
  // OpenFootball backup for Bundesliga if OpenLigaDB is unavailable.
  if(cfg.open){
   try{sources.push(await openFootball(cfg.open));fullSeason=true}
   catch(x){failed.push("OpenFootball backup: "+failText(x))}
  }
 }
 try{sources.push(await sportsDB(cfg.sportsdb))}
 catch(e){failed.push("TheSportsDB: "+failText(e))}
 if(!sources.length)return res.status(502).json({error:"Ücretsiz maç kaynakları geçici olarak erişilemiyor; önceki veriler silinmeyecek.",sources:failed});
 const combined=merge(sources);
 if(!combined.completed.length&&!combined.upcoming.length)return res.status(502).json({error:"Sources returned no usable fixtures.",sources:failed});
 const provider=sources.map(x=>x.source).join(" + ");
 res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=3600");
 return res.status(200).json({
  league,season:"2026-27",provider,sourceUrl:sources[0].link,licensing:sources.map(x=>x.licence).join(" + "),
  timezone:"Per-match ISO UTC when supplied, otherwise source-local and unverified",
  completed:combined.completed,complete:combined.completed,upcoming:combined.upcoming,
  coverageFrom:fullSeason?"2026-08-01":null,coverageTo:fullSeason?"2027-07-31":null,
  replaceWindow:fullSeason,apiKeyRequired:false,updatedAt:new Date().toISOString(),
  warning:[...failed,...sources.map(x=>x.warning).filter(Boolean)].join(" | "),
  sourceNote:cfg.openliga?"OpenLigaDB sports data licensed ODbL; attribution/share-alike obligations may apply.":
   "OpenFootball historical/full fixture database is CC0; TheSportsDB free API has limited coverage."
 });
}