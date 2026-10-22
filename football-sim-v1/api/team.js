// SIMULAB V5 — keyless, provenance-first team and player profiles.
// Uses TheSportsDB public V1 API and Wikipedia community-edited squad lists.
// Wikipedia data is attributed CC BY-SA and must not be represented as a confirmed match XI.
// TheSportsDB free tier provides only a subset of players; only return observed names.
const ROOT="https://www.thesportsdb.com/api/v1/json/123/";
const WIKI="https://en.wikipedia.org/w/api.php";
const CODES={eng:1,esp:1,ger:1,ita:1,fra:1,ucl:1};
const MAX_LEN=85;
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
 .replace(/&/g," and ").replace(/\b(fc|cf|afc|sc|club|football|futbol|de|the|ac|as|calcio)\b/g," ")
 .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const aliases={
 "b dortmund":"borussia dortmund","dortmund":"borussia dortmund",
 "man utd":"manchester united","man city":"manchester city",
 "spurs":"tottenham hotspur","inter":"internazionale",
 "internazionale milano":"internazionale","atleti":"atletico madrid",
 "psg":"paris saint germain","bayern munchen":"bayern munich",
 "real madrid":"real madrid","barca":"barcelona","juve":"juventus",
 "nott m forest":"nottingham forest","ac milan":"milan"
};
function key(s){const n=norm(s);return aliases[n]||n}
function confidence(a,b){
 const x=key(a),y=key(b);
 if(!x||!y)return 0;if(x===y)return 1;
 const aSet=new Set(x.split(" ")),bSet=new Set(y.split(" "));
 const overlap=[...aSet].filter(z=>bSet.has(z)).length;
 return Math.max(overlap/Math.max(aSet.size,bSet.size),overlap/new Set([...aSet,...bSet]).size);
}
async function fetchJSON(url,timeout=11000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const reply=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json","User-Agent":"SIMULAB-Football/5.0 (open-source-data; profile-cache)"}});
  if(!reply.ok)throw Error("HTTP "+reply.status);
  const json=await reply.json();
  if(!json||typeof json!=="object")throw Error("Invalid JSON");
  return json;
 }finally{clearTimeout(timer)}
}
function allowImage(s){
 try{const u=new URL(s);return u.protocol==="https:"&&["r2.thesportsdb.com","www.thesportsdb.com","thesportsdb.com","upload.wikimedia.org"].includes(u.hostname)?u.href:null}catch{return null}
}
function position(p){
 const s=String(p||"").toLowerCase();
 if(/goalkeeper|keeper|kaleci/.test(s)||s==="gk")return "GK";
 if(/defen|centre.back|center.back|full.back|left.back|right.back|stoper|back/.test(s)||s==="df")return "DF";
 if(/midfield|wing.back|orta saha/.test(s)||s==="mf")return "MF";
 if(/forwar|strik|wing|attack|forvet/.test(s)||s==="fw")return "FW";
 return null;
}
function playerData(p){
 const str=s=>String(s||"").slice(0,100);
 return {id:String(p.idPlayer||""),name:str(p.strPlayer).trim(),
  position:position(p.strPosition)||"",positionDetail:str(p.strPosition),
  nationality:str(p.strNationality),dateOfBirth:str(p.dateBorn),number:str(p.strNumber),
  image:allowImage(p.strThumb),source:"TheSportsDB (free sample)",
  sourceUrl:"https://www.thesportsdb.com/player/"+encodeURIComponent(p.idPlayer||""),
  minutes:null,goals:null,assists:null,appearances:null,positions:null,
  status:str(p.strStatus),availability:"unknown",verifiedMatchXI:false};
}
async function sportsTeam(team){
 const url=ROOT+"searchteams.php?t="+encodeURIComponent(team);
 const j=await fetchJSON(url);
 const list=Array.isArray(j.teams)?j.teams:[];
 const rated=list.filter(t=>t?.strSport==="Soccer").map(t=>({raw:t,
  score:Math.max(confidence(team,t.strTeam),confidence(team,t.strTeamAlternate?.split(",")[0]||""))})).sort((a,b)=>b.score-a.score);
 const best=rated[0];
 if(!best||best.score<.5)throw Error("Takım TheSportsDB'de güvenilir biçimde eşleşmedi");
 const item=best.raw,id=String(item.idTeam||"");
 if(!/^\d{4,12}$/.test(id))throw Error("Sağlayıcı takım kimliği geçersiz");
 return {teamId:id,name:item.strTeam,alternate:item.strTeamAlternate,league:item.strLeague,
  stadium:item.strStadium,location:item.strLocation,capacity:Number(item.intStadiumCapacity)||null,
  formed:item.intFormedYear,website:item.strWebsite,
  badge:allowImage(item.strBadge),banner:allowImage(item.strFanart1),
  description:String(item.strDescriptionEN||"").slice(0,340),
  wikipedia:item.strWikipedia||null,wikidata:item.idWikidata||null,
  confidence:best.score,sourceUrl:"https://www.thesportsdb.com/team/"+id};
}
async function sportsPlayers(teamId){
 const url=ROOT+"lookup_all_players.php?id="+encodeURIComponent(teamId);
 const j=await fetchJSON(url,12000);
 const arr=Array.isArray(j.player)?j.player:[];
 return arr.filter(p=>p&&p.strPlayer&&p.strSport==="Soccer")
  .filter(p=>{const role=String(p.strPosition||"").toLowerCase();return !/coach|staff|director|assistant|manager|trainer/.test(role)})
  .filter(p=>!["coaching","retired","inactive"].includes(String(p.strStatus||"").toLowerCase()))
  .slice(0,15).map(playerData);
}
function readableName(text){
 return String(text||"").replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,"$2").replace(/\[\[([^\]]+)\]\]/g,"$1")
 .replace(/\{\{(?:sortname|sort)\|([^|}]+)\|([^}]+)\}\}/gi,"$1 $2")
 .replace(/<[^>]+>/g,"").replace(/'''?/g,"").replace(/&nbsp;/g," ")
 .replace(/\{\{[^}]+\}\}/g,"").replace(/\s+/g," ").trim().slice(0,100);
}
// Nested-template aware scanner: a | inside a wikilink/template is not a parameter separator.
function splitParams(t){
 const parts=[];let value="",template=0,link=0;
 for(let i=0;i<t.length;i++){
  const pair=t.slice(i,i+2);
  if(pair==="{{"){template++;value+=pair;i++;continue}
  if(pair==="}}"&&template){template--;value+=pair;i++;continue}
  if(pair==="[["){link++;value+=pair;i++;continue}
  if(pair==="]]"&&link){link--;value+=pair;i++;continue}
  if(t[i]==="|"&&template===0&&link===0){parts.push(value);value="";continue}
  value+=t[i];
 }
 parts.push(value);
 const o={};
 for(const v of parts){const eq=v.indexOf("=");if(eq>=0)o[v.slice(0,eq).toLowerCase().trim()]=v.slice(eq+1).trim()}
 return o;
}
function playerTemplates(text){
 const list=[],regex=/\{\{\s*(?:fs[_ ]?player|football squad player|squad player)\s*\|/gi;
 let m;
 while((m=regex.exec(text))!==null&&list.length<85){
  const start=m.index,endStart=regex.lastIndex;
  let depth=1,end=-1;
  for(let i=endStart;i<Math.min(text.length,endStart+2400);i++){
   const c=text.slice(i,i+2);
   if(c==="{{"){depth++;i++;continue}
   if(c==="}}"){depth--;if(depth===0){end=i;break}i++}
  }
  if(end<0)continue;
  const params=splitParams(text.slice(endStart,end));
  const name=readableName(params.name||params.player||"");
  const role=position(params.pos||params.position||"");
  if(name&&/[\p{L}]/u.test(name)&&name.length<90){
   list.push({id:"",name,position:role||"",positionDetail:params.pos||"",number:String(params.no||"").replace(/\D/g,"").slice(0,3),
    nationality:readableName(params.nat||"").slice(0,40),dateOfBirth:"",image:null,
    source:"Wikipedia (community-edited)",sourceUrl:"",minutes:null,goals:null,assists:null,appearances:null,positions:null,
    status:"not confirmed",availability:"unknown",verifiedMatchXI:false});
  }
  regex.lastIndex=end+2;
 }
 const uniq=new Map();for(const item of list)uniq.set(key(item.name),item);
 return [...uniq.values()];
}
function extractSquad(raw){
 const wiki=String(raw||"");
 // Prefer the first-team squad section, not academy or staff.
 const headings=[...wiki.matchAll(/^={2,5}\s*(?:First[- ]team squad|Current squad|First team|Playing squad|Senior squad|Squad)\s*={2,5}\s*$/gim)];
 let section=wiki;
 if(headings.length){
  const h=headings[0],level=(h[0].match(/^=+/)||["=="])[0].length;
  let end=wiki.length,sub=/^(={2,5})\s*.+?\s*\1\s*$/gm,m;
  sub.lastIndex=h.index+h[0].length;
  while((m=sub.exec(wiki))!==null){if(m[1].length<=level){end=m.index;break}}
  section=wiki.slice(h.index,end);
 }
 let items=playerTemplates(section);
 if(items.length<11&&!headings.length){items=playerTemplates(wiki.slice(0,120000))}
 return items.slice(0,45);
}
async function wikiSearch(team,known){
 const base="https://en.wikipedia.org/wiki/";
 const manual={
  "bayern munich":"FC Bayern Munich","arsenal":"Arsenal F.C.","chelsea":"Chelsea F.C.",
  "liverpool":"Liverpool F.C.","manchester united":"Manchester United F.C.",
  "manchester city":"Manchester City F.C.","paris saint germain":"Paris Saint-Germain F.C.",
  "real madrid":"Real Madrid CF","barcelona":"FC Barcelona","juventus":"Juventus FC",
  "tottenham hotspur":"Tottenham Hotspur F.C.","borussia dortmund":"Borussia Dortmund",
  "internazionale":"Inter Milan","milan":"AC Milan","atletico madrid":"Atlético Madrid",
  "newcastle united":"Newcastle United F.C.","bayer leverkusen":"Bayer 04 Leverkusen",
  "galatasaray":"Galatasaray S.K.","ajax":"AFC Ajax",
  "napoli":"SSC Napoli"
 };
 const original=manual[key(team)]||null;
 if(original)return original;
 if(known&&typeof known==="string"&&/wikipedia\.org\/wiki\//.test(known)){
  try{const u=new URL(known.startsWith("http")?known:"https://"+known);if(u.hostname==="en.wikipedia.org")return decodeURIComponent(u.pathname.replace(/^\/wiki\//,"")).replace(/_/g," ")}catch{}
 }
 const url=WIKI+"?action=query&list=search&srsearch="+encodeURIComponent(team+" football club")+"&srlimit=5&srnamespace=0&format=json";
 const data=await fetchJSON(url,10000);
 const rows=data.query?.search||[];
 const rated=rows.filter(x=>!/women|season|history|youth|manager|reserve/i.test(x.title))
  .map(x=>({title:x.title,score:confidence(team,x.title)})).sort((a,b)=>b.score-a.score);
 return rated[0]?.score>=.5?rated[0].title:null;
}
async function wikiPlayers(team,profile){
 const title=await wikiSearch(team,profile?.wikipedia);
 if(!title)throw Error("Wikipedia takım sayfası güvenilir biçimde eşleştirilemedi");
 const url=WIKI+"?action=parse&page="+encodeURIComponent(title)+"&prop=wikitext&redirects=1&format=json";
 const data=await fetchJSON(url,16500),raw=data.parse?.wikitext?.["*"];
 if(!raw)throw Error("Wikipedia kadro içeriği alınamadı");
 const players=extractSquad(raw);
 if(players.length<11)throw Error("Wikipedia'dan 11+ oyunculuk güvenilir kadro bulunamadı");
 const sourceUrl="https://en.wikipedia.org/wiki/"+encodeURIComponent(data.parse?.title||title).replace(/%20/g,"_");
 for(const p of players)p.sourceUrl=sourceUrl;
 return {players,sourceUrl,pageTitle:data.parse?.title||title,revisionId:data.parse?.revid||null,licence:"CC BY-SA 4.0"};
}
function merge(roster,free){
 const result=new Map();
 for(const p of roster)result.set(key(p.name),p);
 for(const p of free){
  const k=key(p.name),prior=result.get(k);
  if(prior){result.set(k,{...prior,id:p.id||prior.id,image:p.image||prior.image,
   nationality:p.nationality||prior.nationality,dateOfBirth:p.dateOfBirth||prior.dateOfBirth,
   position:prior.position||p.position,positionDetail:prior.positionDetail||p.positionDetail,
   profileSource:"Wikipedia + TheSportsDB",number:prior.number||p.number})}
  else if(roster.length<11)result.set(k,p); // If squad is Wikipedia complete, omit extra possibly stale SportsDB players.
 }
 return [...result.values()].slice(0,50);
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const team=String(req.query?.team||"").trim().slice(0,MAX_LEN),league=String(req.query?.league||"");
 if(!team||!/[\p{L}]{2,}/u.test(team)||!Object.prototype.hasOwnProperty.call(CODES,league))
  return res.status(400).json({error:"Takım ve altı turnuvadan biri zorunlu"});
 let profile=null,players=[],wiki=null,extras=[],errors=[];
 // Start Wikipedia and provider lookups together: no unnecessary serial latency.
 const sportPromise=sportsTeam(team).then(async p=>{
  let roster=[];
  try{roster=await sportsPlayers(p.teamId)}catch(e){errors.push("TheSportsDB oyuncu: "+String(e.message||e).slice(0,100))}
  return {profile:p,roster};
 });
 const [sports,wikipedia]=await Promise.allSettled([sportPromise,wikiPlayers(team,null)]);
 if(sports.status==="fulfilled"){profile=sports.value.profile;extras=sports.value.roster}
 else errors.push("TheSportsDB takım: "+String(sports.reason?.message||"erişilemedi").slice(0,90));
 if(wikipedia.status==="fulfilled")wiki=wikipedia.value;
 else errors.push("Wikipedia kadro: "+String(wikipedia.reason?.message||"erişilemedi").slice(0,110));
 players=merge(wiki?.players||[],extras);
 const origin=wiki?"Wikipedia (community-edited), supplemented by TheSportsDB":extras.length?"TheSportsDB limited free sample":"No reliable roster";
 const now=new Date().toISOString();
 res.setHeader("Cache-Control","public, s-maxage=14400, stale-while-revalidate=14400");
 return res.status(200).json({
  requestedTeam:team,league,team:profile?.name||team,profile,players,playerCount:players.length,
  rosterCoverage:wiki?"community squad, not official or match XI":extras.length?"incomplete sample, NOT full squad":"no roster",
  automaticXIAllowed:wiki?.players?.length>=11,
  confirmedXI:false,confirmedAbsences:false,confirmedPositionsByMatch:false,
  revisionId:wiki?.revisionId||null,rosterUrl:wiki?.sourceUrl||null,
  attribution:wiki?"Wikipedia contributors, CC BY-SA 4.0; "+wiki.sourceUrl:"TheSportsDB public free API; provider terms apply",
  source:origin,sourceErrors:errors,updatedAt:now,
  limitation:"No proof of current player registration, starts, suspensions or match minutes. Always check official XI before kickoff."
 });
}