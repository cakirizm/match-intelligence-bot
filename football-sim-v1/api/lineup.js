// SIMULAB V5 match-day XI lookup using documented free TheSportsDB API.
// Free API lookup lineups may be limited to only 5 records. No incomplete XI is treated as confirmed.
const ROOT="https://www.thesportsdb.com/api/v1/json/123/";
const clean=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|afc|sc|club|football|futbol|the|de)\b/g," ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const alias={"man utd":"manchester united","b dortmund":"borussia dortmund","inter":"internazionale","psg":"paris saint germain","atleti":"atletico madrid","bayern munchen":"bayern munich"};
function key(x){const s=clean(x);return alias[s]||s}
function similar(a,b){const x=key(a),y=key(b);if(x===y&&x)return 1;const u=new Set(x.split(" ").filter(Boolean)),v=new Set(y.split(" ").filter(Boolean));const both=[...u].filter(w=>v.has(w)).length;return both/Math.max(1,Math.max(u.size,v.size))}
async function fetchJSON(url){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),11500);
 try{const r=await fetch(url,{signal:c.signal,headers:{"Accept":"application/json"}});if(!r.ok)throw Error("Provider HTTP "+r.status);return await r.json()}
 finally{clearTimeout(timer)}
}
const mappedRole=s=>/keeper/i.test(s)?"GK":/defen|back/i.test(s)?"DF":/midfield/i.test(s)?"MF":/attack|forward|wing|strik/i.test(s)?"FW":"";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const home=String(req.query?.home||"").trim().slice(0,90),away=String(req.query?.away||"").trim().slice(0,90),date=String(req.query?.date||"").slice(0,10);
 if(!home||!away||!/^\d{4}-\d\d-\d\d$/.test(date))return res.status(400).json({error:"İki takım ve ISO maç tarihi zorunlu"});
 const existingId=String(req.query?.id||"");
 let event=null,errors=[];
 try{
  if(/^\d{5,12}$/.test(existingId)){
   const data=await fetchJSON(ROOT+"lookupevent.php?id="+encodeURIComponent(existingId));
   const candidate=(data.events||[])[0];
   if(candidate&&similar(home,candidate.strHomeTeam)>.7&&similar(away,candidate.strAwayTeam)>.7&&candidate.dateEvent===date)event=candidate;
  }
  if(!event){
   const name=home+"_vs_"+away;
   const data=await fetchJSON(ROOT+"searchevents.php?e="+encodeURIComponent(name));
   const list=Array.isArray(data.event)?data.event:[];
   event=list.find(x=>x.dateEvent===date&&similar(home,x.strHomeTeam)>.7&&similar(away,x.strAwayTeam)>.7)||null;
  }
 }catch(e){errors.push(String(e.message||e).slice(0,100))}
 if(!event){
  res.setHeader("Cache-Control","public, s-maxage=1800");
  return res.status(200).json({matchedEvent:false,players:{home:[],away:[]},complete:false,
   message:"Maç, ücretsiz TheSportsDB verisinde tarih ve takımlar açısından doğrulanamadı. Kaynaktan resmî ilk 11 elde edilemedi.",errors});
 }
 let list=[];
 try{
  const details=await fetchJSON(ROOT+"lookuplineup.php?id="+encodeURIComponent(event.idEvent));
  list=Array.isArray(details.lineup)?details.lineup:[];
 }catch(e){errors.push(String(e.message||e).slice(0,120))}
 const group={home:[],away:[]};
 for(const p of list){
  if(!p?.strPlayer||String(p.strSubstitute).toLowerCase()==="yes")continue;
  const clubSide=String(p.strHome).toLowerCase()==="yes"?"home":String(p.strHome).toLowerCase()==="no"?"away":null;
  if(!clubSide)continue;
  group[clubSide].push({id:String(p.idPlayer||""),name:String(p.strPlayer).slice(0,90),
   position:mappedRole(p.strPosition||""),role:String(p.strPosition||"").slice(0,50),shirt:String(p.intSquadNumber||"").slice(0,4)});
 }
 const full=group.home.length===11&&group.away.length===11;
 res.setHeader("Cache-Control","public,s-maxage=1800,stale-while-revalidate=3600");
 return res.status(200).json({
  matchedEvent:true,eventId:String(event.idEvent),matchedDate:date,teams:{home:event.strHomeTeam,away:event.strAwayTeam},
  players:group,complete:full,verifiedOfficial:false,source:"TheSportsDB free match lineup",
  sourceUrl:"https://www.thesportsdb.com/event/"+encodeURIComponent(event.idEvent),
  message:full?"Sağlayıcı tam 11'er oyuncu verdi; resmî federasyon/klüp kaydıyla ayrıca teyit edilmeli.":
  "Sağlayıcı yalnızca "+group.home.length+" ev sahibi ve "+group.away.length+" deplasman oyuncusu döndürdü. Eksik kadro kesin ilk 11 değildir.",
  errors,updatedAt:new Date().toISOString()
 });
}