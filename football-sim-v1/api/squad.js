// SIMULAB V3: Basic registered-team/squad catalog from football-data.org.
// Premium lineups, exact match positions, minutes and advanced player stats are NOT available on the free plan.
// Never treat the squad list as an official matchday XI.
const CODES={eng:"PL",esp:"PD",ger:"BL1",ita:"SA",fra:"FL1",ucl:"CL"};
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\b(fc|cf|afc|ac|sc|club|the|football|futbol|calcio|1907|munchen|muenchen)\b/g," ").replace(/\s+/g," ").trim();
const safeText=s=>typeof s==="string"?s.slice(0,90):"";
const score=(a,b)=>{const x=new Set(norm(a).split(" ").filter(Boolean)),y=new Set(norm(b).split(" ").filter(Boolean));if(!x.size||!y.size)return 0;const shared=[...x].filter(t=>y.has(t)).length;return shared/new Set([...x,...y]).size};
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Only GET is supported"});
 const league=typeof req.query.league==="string"?req.query.league:"";
 if(!Object.prototype.hasOwnProperty.call(CODES,league))return res.status(400).json({error:"Unsupported competition"});
 const team=typeof req.query.team==="string"?req.query.team.trim().slice(0,80):"";
 if(!team)return res.status(400).json({error:"Team name is required"});
 const token=process.env.FOOTBALL_DATA_API_KEY;
 if(!token)return res.status(503).json({error:"Ücretsiz oyuncu kaynağı bağlı değil. Vercel'e FOOTBALL_DATA_API_KEY ekleyin.",source:"football-data.org"});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14500);
 try{
  const url="https://api.football-data.org/v4/competitions/"+CODES[league]+"/teams";
  const reply=await fetch(url,{signal:controller.signal,headers:{"X-Auth-Token":token,"Accept":"application/json"}});
  if(!reply.ok){return res.status(reply.status===429?429:502).json({error:"Oyuncu listesi kaynaktan alınamadı (HTTP "+reply.status+"). Ücretsiz plan kapsamı yetersiz olabilir.",source:"football-data.org"})}
  const body=await reply.json(),teams=Array.isArray(body.teams)?body.teams:[];
  const rated=teams.map(t=>({t,rank:score(team,t.name),match:Math.max(score(team,t.shortName),score(team,t.name))})).sort((a,b)=>b.match-a.match);
  const best=rated[0];
  if(!best||best.match<.46)return res.status(404).json({error:"Takım kaynakla güvenilir biçimde eşleştirilemedi.",candidates:rated.slice(0,4).map(x=>({team:x.t.name,score:x.match}))});
  if(rated.length>1&&best.match-rated[1].match<.08&&best.match<.9)return res.status(409).json({error:"Birden fazla olası takım bulundu; manuel doğrulama gerekli.",candidates:rated.slice(0,4).map(x=>({team:x.t.name,score:x.match}))});
  const t=best.t;
  let squad=Array.isArray(t.squad)?t.squad:[];
  squad=squad.filter(p=>p&&p.name).slice(0,65).map(p=>({
   id:Number.isInteger(p.id)?p.id:null,name:safeText(p.name),position:safeText(p.position||""),
   nationality:safeText(p.nationality||""),dateOfBirth:typeof p.dateOfBirth==="string"?p.dateOfBirth.slice(0,10):null,
   source:"football-data.org",matchesByPosition:null,minutes:null,goals:null,assists:null
  }));
  res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=7200");
  return res.status(200).json({source:"football-data.org",team:t.name,teamId:t.id,matchConfidence:Number(best.match.toFixed(2)),competition:league,season:body.season?.startDate||null,rosterIsMatchXI:false,players:squad,
   coverage:squad.length?"Takımın temel kayıtlı kadrosu. Maç ilk 11'i ve mevki maç sayıları değildir.":"Ücretsiz planda veya bu takım için oyuncu listesi sunulmadı; oyuncular manuel girilmeli.",fetchedAt:new Date().toISOString()});
 }catch(e){return res.status(502).json({error:"Oyuncu kaynağına erişilemiyor: "+String(e.message||e).slice(0,130)})}
 finally{clearTimeout(timer)}
}