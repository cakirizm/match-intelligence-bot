// Keyless player detail lookup. Only display provider-supplied values;
// /lookupplayerstats is best effort and may not be available on the free tier.
const ROOT="https://www.thesportsdb.com/api/v1/json/123/";
async function fetchJSON(url){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw Error("HTTP "+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
}
const number=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v);
const brief=v=>String(v??"").slice(0,180);
const image=v=>{try{const u=new URL(v);return u.protocol==="https:"&&["r2.thesportsdb.com","www.thesportsdb.com"].includes(u.hostname)?u.href:null}catch{return null}};
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const id=String(req.query?.id||"");
 if(!/^\d{3,15}$/.test(id))return res.status(400).json({error:"Invalid player id"});
 const look=await Promise.allSettled([fetchJSON(ROOT+"lookupplayer.php?id="+id),fetchJSON(ROOT+"lookupplayerstats.php?id="+id)]);
 const player=look[0].status==="fulfilled"&&Array.isArray(look[0].value?.players)?look[0].value.players[0]:null;
 if(!player)return res.status(404).json({error:"Ücretsiz kaynaktan oyuncu detayı bulunamadı"});
 const raw=look[1].status==="fulfilled"?look[1].value:null;
 const stats=raw?.playerstats||raw?.statistics||raw?.stats||[];
 const sampled=Array.isArray(stats)?stats.slice(0,15).map(r=>{
  const entry={season:brief(r.strSeason||r.season||""),team:brief(r.strTeam||r.team||""),league:brief(r.strLeague||r.league||"")};
  for(const [k,aliases] of Object.entries({appearances:["intAppearances","intApps","appearances"],starts:["intStarts","starts"],minutes:["intMinutes","minutes"],goals:["intGoals","goals"],assists:["intAssists","assists"],yellowCards:["intYellowCards","yellowCards"],redCards:["intRedCards","redCards"]})){
   const found=aliases.map(x=>r[x]).find(v=>v!==undefined&&v!==null&&v!=="");entry[k]=number(found);
  }
  return entry;
 }):[];
 res.setHeader("Cache-Control","public,s-maxage=21600,stale-while-revalidate=43200");
 return res.status(200).json({source:"TheSportsDB free API",dataIsVerifiedOfficialMatchStats:false,updatedAt:new Date().toISOString(),
  player:{id,name:brief(player.strPlayer),team:brief(player.strTeam),position:brief(player.strPosition),number:brief(player.strNumber),
   nationality:brief(player.strNationality),dateBorn:brief(player.dateBorn),height:brief(player.strHeight),status:brief(player.strStatus),
   image:image(player.strThumb),summary:brief(player.strDescriptionEN),profileUrl:"https://www.thesportsdb.com/player/"+id},
  stats:sampled,statsAvailable:sampled.length>0,statsMessage:sampled.length?"Provider returned the listed samples; season and playing time may be incomplete.":"Ücretsiz kaynak maç/mevki/dakika istatistiği göndermedi."});
}