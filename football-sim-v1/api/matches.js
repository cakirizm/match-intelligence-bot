// Optional football-data.org FREE tier server proxy. Secret never sent to the browser.
// Configure FOOTBALL_DATA_API_KEY as Vercel project env variable. Free tier delayed scores.
const CODES={eng:"PL",esp:"PD",ger:"BL1",ita:"SA",fra:"FL1",ucl:"CL"};
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const league=typeof req.query.league==="string"?req.query.league:"";
 if(!Object.prototype.hasOwnProperty.call(CODES,league))return res.status(400).json({error:"Geçersiz lig"});
 const token=process.env.FOOTBALL_DATA_API_KEY;
 if(!token)return res.status(503).json({error:"Ücretsiz API bağlantısı henüz yapılandırılmadı.",setup:"Vercel → Project Settings → Environment Variables → FOOTBALL_DATA_API_KEY"});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
 try{
  const url="https://api.football-data.org/v4/competitions/"+CODES[league]+"/matches";
  const response=await fetch(url,{headers:{"X-Auth-Token":token,"Accept":"application/json"},signal:controller.signal});
  if(!response.ok){
   let detail="";try{detail=JSON.stringify(await response.json()).slice(0,200)}catch{}
   return res.status(response.status===429?429:502).json({error:"Veri servisi HTTP "+response.status,detail});
  }
  const json=await response.json();
  if(!Array.isArray(json.matches))throw Error("Maç listesi bulunamadı.");
  const completed=[],upcoming=[];
  for(const m of json.matches){
   const date=String(m.utcDate||"").slice(0,10),home=String(m.homeTeam?.name||m.homeTeam?.shortName||"").trim(),away=String(m.awayTeam?.name||m.awayTeam?.shortName||"").trim(),time=String(m.utcDate||"").slice(11,16);
   if(!/^\d{4}-\d\d-\d\d$/.test(date)||!home||!away)continue;
   const ft=m.score?.fullTime,scoreValid=Number.isInteger(ft?.home)&&Number.isInteger(ft?.away)&&ft.home>=0&&ft.away>=0;
   if(m.status==="FINISHED"&&scoreValid)completed.push({date,time,home,away,hg:ft.home,ag:ft.away,source:"football-data.org",season:m.season?.startDate?.slice(0,4)||""});
   else if(["SCHEDULED","TIMED"].includes(m.status))upcoming.push({date,time,home,away,status:m.status,source:"football-data.org"});
  }
  res.setHeader("Cache-Control","public, s-maxage=1200, stale-while-revalidate=600");
  return res.status(200).json({league,provider:"football-data.org free tier",delayed:true,completed,upcoming,updatedAt:new Date().toISOString()});
 }catch(e){return res.status(502).json({error:"Maç API'sine erişilemedi",detail:String(e.message||e).slice(0,140)})}finally{clearTimeout(timer)}
}