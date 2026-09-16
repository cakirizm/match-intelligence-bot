const BASE='https://api.football-data.org/v4';
function token(){return process.env.FOOTBALL_DATA_TOKEN}
export function hasFootballDataToken(){return Boolean(token())}

async function request(path,params={}){
  if(!token()) return [];
  const url=new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});
  const res=await fetch(url,{headers:{'X-Auth-Token':token()},cache:'no-store'});
  if(!res.ok) return [];
  return res.json();
}

export async function matchesByDateFD(date){
  const json=await request('/matches',{dateFrom:date,dateTo:date});
  return json?.matches||[];
}
