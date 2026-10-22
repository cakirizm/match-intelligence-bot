// Optional verified-match-lineup source: TheSportsDB v1 match ID ONLY.
// Free plan can return partial rows; never infer missing players or mark confirmed unless 11 starters per side.
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const event=String(req.query?.event||"");
 if(!/^\d{4,15}$/.test(event))return res.status(400).json({error:"Valid TheSportsDB event id is required"});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11500);
 try{
  const reply=await fetch("https://www.thesportsdb.com/api/v1/json/123/lookuplineup.php?id="+event,{signal:ctrl.signal,headers:{"Accept":"application/json"}});
  if(!reply.ok)throw Error("HTTP "+reply.status);
  const payload=await reply.json(),raw=Array.isArray(payload.lineup)?payload.lineup:[];
  const filterSide=flag=>raw.filter(p=>String(p.strHome||"").toLowerCase()===flag&&String(p.strSubstitute||"").toLowerCase()==="no")
    .filter(p=>p.strPlayer).map(p=>({name:String(p.strPlayer||"").slice(0,90),position:String(p.strPosition||"").slice(0,40),
    shirt:String(p.intSquadNumber||"").slice(0,3),playerId:String(p.idPlayer||"")}));
  const home=filterSide("yes"),away=filterSide("no"),confirmed=home.length===11&&away.length===11;
  res.setHeader("Cache-Control","public,s-maxage=300,stale-while-revalidate=600");
  return res.status(200).json({event,provider:"TheSportsDB v1 free lineup API",home,away,
   isCompleteXI:confirmed,verifiedByOfficialClub:false,
   status:confirmed?"Full source-listed first XI":"Partial / unavailable — not a confirmed first XI",
   disclaimer:"Source-listed lineup is not independently cross-verified against official team announcements. Free tier may return at most 5 records."});
 }catch(e){return res.status(502).json({error:"Ücretsiz maç kadrosu kaynağına erişilemiyor.",detail:String(e.message||e).slice(0,100)})}
 finally{clearTimeout(timer)}
}