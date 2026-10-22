// SIMULAB V3 free, keyless match discovery.
// Source: ESPN public web endpoints (unofficial, undocumented, may stop working).
// Uses one server-side, cached, read-only request per league. Never claims licensing.
const LEAGUES={eng:"eng.1",esp:"esp.1",ger:"ger.1",ita:"ita.1",fra:"fra.1",ucl:"uefa.champions"};
function ymd(date){const d=new Date(date);if(Number.isNaN(d.valueOf()))return null;return d.toISOString().slice(0,10)}
function dateParam(date){return date.toISOString().slice(0,10).replace(/-/g,"")}
function teamLabel(c){
 const t=c?.team||{};
 return String(t.displayName||t.name||t.shortDisplayName||t.abbreviation||"").trim().slice(0,90);
}
function parseEvent(event){
 const comp=event?.competitions?.[0],participants=comp?.competitors||[];
 const home=participants.find(c=>c.homeAway==="home"),away=participants.find(c=>c.homeAway==="away");
 if(!home||!away)return null;
 const homeName=teamLabel(home),awayName=teamLabel(away),iso=String(event.date||comp?.date||"");
 if(!homeName||!awayName||!ymd(iso))return null;
 const status=event?.status?.type||comp?.status?.type||{};
 const complete=status.completed===true||status.state==="post";
 const num=c=>{const s=c?.score;const n=typeof s==="object"?Number(s?.value??s?.displayValue):Number(s);return Number.isInteger(n)&&n>=0&&n<45?n:null};
 const hg=num(home),ag=num(away);
 const base={date:iso.slice(0,10),time:iso.slice(11,16),kickoff:iso,home:homeName,away:awayName,
  eventId:String(event.id||""),provider:"ESPN web feed (unofficial)",updatedAt:new Date().toISOString()};
 if(complete&&hg!==null&&ag!==null)return {...base,hg,ag,source:"ESPN web feed",isResult:true};
 if(complete)return null; // Never fabricate a completed match without a confirmed score
 return {...base,status:status.description||"Scheduled",source:"ESPN web feed",isResult:false};
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Only GET supported"});
 const league=typeof req.query?.league==="string"?req.query.league:"";
 if(!Object.prototype.hasOwnProperty.call(LEAGUES,league))return res.status(400).json({error:"Unsupported league"});
 const now=new Date(),from=new Date(now.getTime()-42*86400000),to=new Date(now.getTime()+108*86400000);
 const dates=dateParam(from)+"-"+dateParam(to);
 const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+LEAGUES[league]+"/scoreboard?dates="+dates+"&limit=400";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14500);
 try{
  const reply=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});
  if(!reply.ok)throw Error("ESPN HTTP "+reply.status);
  const doc=await reply.json();
  if(!Array.isArray(doc.events))throw Error("Unknown public scoreboard response");
  const parsed=doc.events.map(parseEvent).filter(Boolean);
  const uniq=new Map();
  for(const game of parsed)uniq.set(game.eventId||[game.date,game.home,game.away].join("|"),game);
  const all=[...uniq.values()].sort((a,b)=>a.kickoff.localeCompare(b.kickoff));
  res.setHeader("Cache-Control","public, s-maxage=1200, stale-while-revalidate=3600");
  res.status(200).json({
    league,provider:"ESPN public web scoreboard (undocumented)",officialApi:false,sourceUpdatedAt:new Date().toISOString(),
    coverageFrom:ymd(from),coverageTo:ymd(to),returnedEvents:doc.events.length,
    complete:all.filter(e=>e.isResult),upcoming:all.filter(e=>!e.isResult),
    disclaimer:"Unofficial publicly accessible web endpoint; subject to provider terms, changes and outages."
  });
 }catch(error){
  res.setHeader("Cache-Control","public, s-maxage=120");
  res.status(502).json({error:"Ücretsiz fikstür akışına şu anda erişilemedi.",detail:String(error?.message||error).slice(0,170),provider:"ESPN public web feed"});
 }finally{clearTimeout(timer)}
}