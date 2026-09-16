const BASE='https://v3.football.api-sports.io';

function key(){return process.env.API_FOOTBALL_KEY}
export function hasApiFootballKey(){return Boolean(key())}

async function request(path,params={}){
  if(!key()) throw new Error('API_FOOTBALL_KEY tanımlı değil.');
  const url=new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});
  const res=await fetch(url,{headers:{'x-apisports-key':key()},next:{revalidate:300}});
  const json=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(`API-Football ${res.status}: ${JSON.stringify(json).slice(0,260)}`);
  if(json?.errors&&Object.keys(json.errors).length) throw new Error(`API-Football: ${JSON.stringify(json.errors).slice(0,260)}`);
  return json.response||[];
}

export const fixturesByDateAF=(date,timezone='Asia/Dubai')=>request('/fixtures',{date,timezone});
export const fixtureByIdAF=id=>request('/fixtures',{id});
export const predictionAF=id=>request('/predictions',{fixture:id});
export const oddsAF=id=>request('/odds',{fixture:id});
export const h2hAF=(homeId,awayId,last=10)=>request('/fixtures/headtohead',{h2h:`${homeId}-${awayId}`,last});
export const recentAF=(teamId,last=10)=>request('/fixtures',{team:teamId,last});
export const injuriesAF=id=>request('/injuries',{fixture:id});
export const standingsAF=(league,season)=>request('/standings',{league,season});
