// SIMULAB V4: Free, keyless 2026/27 fixtures/results for 5 leagues + UCL.
// 1) fixturedownload.com public JSON; 2) open-matchday noncommercial backup.
// Scores ONLY considered final if both supplied and kickoff in the past.
// The sources are independent services, not official guarantees.
const LEAGUES={
 eng:{feed:"epl-2026",folder:"ENG_1_premier-league"},
 esp:{feed:"la-liga-2026",folder:"ESP_1_la-liga"},
 ger:{feed:"bundesliga-2026",folder:"GER_1_bundesliga"},
 ita:{feed:"serie-a-2026",folder:"ITA_1_serie-a"},
 fra:{feed:"ligue-1-2026",folder:"FRA_1_ligue-1"},
 ucl:{feed:"champions-league-2026",folder:"UEFA_1_champions-league"}
};
const numeric=v=>v===null||v===undefined||v===""?null:Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<30?Number(v):null;
const isoDate=s=>/^\d{4}-\d\d-\d\d$/.test(String(s||""))&&!Number.isNaN(Date.parse(s));
async function fetchText(url,timeout=12000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json,text/csv,*/*"}});
  if(!response.ok)throw Error("HTTP "+response.status);return await response.text();
 }finally{clearTimeout(timer)}
}
function csvRows(s){
 const rows=[];let row=[],v="",q=false;
 s=s.replace(/^\uFEFF/,"");
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){if(q&&s[i+1]==='"'){v+='"';i++}else q=!q}
  else if(c===","&&!q){row.push(v);v=""}
  else if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&s[i+1]==="\n")i++;row.push(v);if(row.some(Boolean))rows.push(row);row=[];v=""}
  else v+=c;
 }
 row.push(v);if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error("CSV boş");
 const head=rows.shift().map(x=>x.trim().toLowerCase());
 return rows.map(r=>Object.fromEntries(head.map((k,i)=>[k,String(r[i]||"").trim()])));
}
function normalized(data){
 const done=new Map(),future=new Map(),key=m=>m.date+"|"+m.home.toLowerCase()+"|"+m.away.toLowerCase();
 for(const r of data.completed)if(r.home&&r.away&&isoDate(r.date))done.set(key(r),r);
 for(const f of data.upcoming)if(f.home&&f.away&&isoDate(f.date)&&!done.has(key(f)))future.set(key(f),f);
 return {...data,completed:[...done.values()].sort((a,b)=>a.date.localeCompare(b.date)),upcoming:[...future.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
async function primary(l){
 const url="https://fixturedownload.com/feed/json/"+l.feed;
 const raw=JSON.parse(await fetchText(url));
 if(!Array.isArray(raw)||!raw.length)throw Error("Fixture Download şeması beklenen biçimde değil.");
 const completed=[],upcoming=[],today=new Date().toISOString().slice(0,10);
 for(const m of raw){
  const utc=String(m.DateUtc||""),date=utc.slice(0,10),home=String(m.HomeTeam||"").trim(),away=String(m.AwayTeam||"").trim();
  if(!isoDate(date)||!home||!away||home===away||/^TBD\b/i.test(home)||/^TBD\b/i.test(away))continue;
  const one=numeric(m.HomeTeamScore),two=numeric(m.AwayTeamScore);
  const time=utc.slice(11,16),round=m.RoundNumber==null?null:String(m.RoundNumber);
  const kickoffUtc=utc&&(/Z$/i.test(utc)?utc:utc.replace(" ","T")+"Z");
  const base={date,time,home,away,round,kickoffUtc,source:"Fixture Download",matchId:String(m.MatchNumber||"")};
  if(date<=today&&one!==null&&two!==null)completed.push({...base,hg:one,ag:two});
  else upcoming.push(base);
 }
 const data=normalized({completed,upcoming});
 if(!data.completed.length&&!data.upcoming.length)throw Error("Sezon fikstürü boş");
 return {...data,provider:"Fixture Download",timezone:"UTC",sourceUrl:url,licensing:"Provider terms apply"};
}
async function secondary(l){
 const base="https://raw.githubusercontent.com/oladeeayo/open-matchday/main/data/"+l.folder+"/";
 const contents=await Promise.all(["results_2627.csv","fixtures_2627.csv"].map(name=>fetchText(base+name)));
 const results=csvRows(contents[0]),fixtures=csvRows(contents[1]),completed=[],upcoming=[];
 for(const x of results){
  const h=numeric(x.ft_home),a=numeric(x.ft_away);
  if(!isoDate(x.date)||h===null||a===null||!x.home||!x.away)continue;
  completed.push({date:x.date,time:x.time||"",home:x.home,away:x.away,hg:h,ag:a,round:x.gw||null,source:"Open Matchday (yedek)"});
 }
 for(const x of fixtures){
  if(!isoDate(x.date)||!x.home||!x.away)continue;
  upcoming.push({date:x.date,time:x.time||"",home:x.home,away:x.away,round:x.gw||null,source:"Open Matchday (yedek)"});
 }
 const data=normalized({completed,upcoming});
 if(!data.completed.length&&!data.upcoming.length)throw Error("Yedek kaynak boş");
 return {...data,provider:"Open Matchday (attributed noncommercial backup)",timezone:"provider local (unverified)",
   sourceUrl:"https://github.com/oladeeayo/open-matchday/tree/main/data/"+l.folder,licensing:"Personal, informational, non-commercial use; provider terms apply"};
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const league=typeof req.query?.league==="string"?req.query.league:"";
 if(!Object.prototype.hasOwnProperty.call(LEAGUES,league))return res.status(400).json({error:"Unsupported league"});
 let result;
 try{result=await primary(LEAGUES[league])}
 catch(primaryError){
  try{result=await secondary(LEAGUES[league]);result.warning="Birincil kaynak geçici hatalı: "+String(primaryError.message||primaryError).slice(0,110)}
  catch(secondaryError){
   return res.status(502).json({error:"İki ücretsiz maç kaynağına da erişilemedi.",primary:String(primaryError.message||primaryError).slice(0,140),secondary:String(secondaryError.message||secondaryError).slice(0,140)});
  }
 }
 res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=1800");
 const addKickoff=x=>({...x,kickoff:x.kickoffUtc||null});
 return res.status(200).json({
  league,season:"2026-27",fetchedAt:new Date().toISOString(),
  provider:result.provider,sourceUrl:result.sourceUrl,licensing:result.licensing,timezone:result.timezone,
  complete:result.completed.map(addKickoff),completed:result.completed.map(addKickoff),
  upcoming:result.upcoming.map(addKickoff),
  coverageFrom:"2026-08-01",coverageTo:"2027-07-31",replaceWindow:true,
  officialApi:false,apiKeyRequired:false,
  warning:result.warning||null,
  note:"Public season schedule feed. Times from primary are UTC; data subject to provider terms and updates."
 });
}