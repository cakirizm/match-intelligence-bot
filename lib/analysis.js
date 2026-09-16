const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};

export function getTeams(fixture){
  const p=fixture?.participants||[];
  const home=p.find(x=>String(x?.meta?.location||'').toLowerCase()==='home')||p[0];
  const away=p.find(x=>String(x?.meta?.location||'').toLowerCase()==='away')||p[1];
  return {home,away};
}

function odds1x2(f){
  const src=[...(f?.premiumOdds||[]),...(f?.odds||[])];
  const out={home:[],draw:[],away:[]};
  for(const o of src){
    const label=`${o?.label||''} ${o?.name||''}`.toLowerCase();
    const v=n(o?.value); if(!v||v<=1) continue;
    if(/\b(home|1)\b/.test(label)&&!/1x|12|draw no bet/.test(label)) out.home.push(v);
    else if(/\b(draw|x)\b/.test(label)&&!/1x|x2/.test(label)) out.draw.push(v);
    else if(/\b(away|2)\b/.test(label)&&!/x2|12/.test(label)) out.away.push(v);
  }
  const med=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
  return {home:med(out.home),draw:med(out.draw),away:med(out.away)};
}

function devig(o){
  if(!o.home||!o.draw||!o.away)return null;
  const r={home:1/o.home,draw:1/o.draw,away:1/o.away}; const t=r.home+r.draw+r.away;
  return {home:r.home/t,draw:r.draw/t,away:r.away/t,overround:t-1};
}

function findPred(v,seen=new Set()){
  if(!v||typeof v!=='object'||seen.has(v))return null; seen.add(v);
  if(!Array.isArray(v)){
    const m=Object.fromEntries(Object.keys(v).map(k=>[k.toLowerCase(),k]));
    const hk=m.home||m.home_win||m['1'],dk=m.draw||m.x,ak=m.away||m.away_win||m['2'];
    if(hk&&dk&&ak){let h=n(v[hk]),d=n(v[dk]),a=n(v[ak]);if(h!==null&&d!==null&&a!==null){if(Math.max(h,d,a)>1.01){h/=100;d/=100;a/=100}const t=h+d+a;if(t>0)return {home:h/t,draw:d/t,away:a/t};}}
  }
  for(const k of Object.keys(v)){const x=findPred(v[k],seen);if(x)return x} return null;
}

function finishedScore(match,teamId){
  const parts=match?.participants||[],opp=parts.find(p=>p.id!==teamId);
  const scores=match?.scores||[];
  const pick=id=>scores.filter(s=>s?.participant_id===id).map(s=>n(s?.score?.goals)).filter(x=>x!==null).pop();
  const gf=pick(teamId),ga=pick(opp?.id); return gf===undefined||ga===undefined?null:{gf,ga};
}

function history(matches,teamId){
  let played=0,pts=0,gf=0,ga=0;
  for(const m of matches||[]){
    const s=finishedScore(m,teamId); if(!s)continue;
    played++;gf+=s.gf;ga+=s.ga;pts+=s.gf>s.ga?3:s.gf===s.ga?1:0;if(played>=10)break;
  }
  return played?{played,ppg:pts/played,gf:gf/played,ga:ga/played}:null;
}

function poisson(k,l){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f}
function poissonModel(h,a){
  if(!h||!a)return null;
  const lh=clamp(((h.gf+a.ga)/2)*1.08,.25,3.6),la=clamp(((a.gf+h.ga)/2)*.96,.2,3.2);
  let home=0,draw=0,away=0;
  for(let i=0;i<=7;i++)for(let j=0;j<=7;j++){const p=poisson(i,lh)*poisson(j,la);if(i>j)home+=p;else if(i===j)draw+=p;else away+=p}
  const t=home+draw+away;return {home:home/t,draw:draw/t,away:away/t,lh,la};
}

function h2hShift(matches,homeId,awayId){
  let diff=0,c=0;
  for(const m of matches||[]){const h=finishedScore(m,homeId),a=finishedScore(m,awayId);if(!h||!a)continue;diff+=h.gf>h.ga?1:h.gf<h.ga?-1:0;c++;if(c>=6)break}
  return c?clamp((diff/c)*.02,-.02,.02):0;
}

function injuryShift(f,homeId,awayId){
  let h=0,a=0;for(const x of f?.sidelined||[]){const id=x?.team_id||x?.participant_id||x?.player?.team_id;if(id===homeId)h++;if(id===awayId)a++}return clamp((a-h)*.008,-.05,.05);
}

export function analyzeFixture(fixture,context={}){
  const {home,away}=getTeams(fixture),odds=odds1x2(fixture),market=devig(odds),provider=findPred(fixture?.predictions||[]);
  const hh=history(context.homeRecent,home?.id),ah=history(context.awayRecent,away?.id),pois=poissonModel(hh,ah);
  let base;
  if(provider&&pois)base={home:provider.home*.6+pois.home*.4,draw:provider.draw*.6+pois.draw*.4,away:provider.away*.6+pois.away*.4,source:'ensemble'};
  else if(provider)base={...provider,source:'prediction'};
  else if(pois)base={...pois,source:'poisson'};
  else if(market)base={home:market.home,draw:market.draw,away:market.away,source:'market-only'};
  else base={home:.40,draw:.29,away:.31,source:'fallback'};

  const form=hh&&ah?clamp(((hh.ppg-ah.ppg)/3)*.05+(((hh.gf-hh.ga)-(ah.gf-ah.ga))/3)*.03,-.08,.08):0;
  const shift=form+h2hShift(context.h2h,home?.id,away?.id)+injuryShift(fixture,home?.id,away?.id);
  let p={home:clamp(base.home+shift,.05,.9),away:clamp(base.away-shift*.8,.05,.9),draw:base.draw};
  p.draw=clamp(1-p.home-p.away,.08,.4);const t=p.home+p.draw+p.away;p={home:p.home/t,draw:p.draw/t,away:p.away/t};

  const labels={home:'MS 1',draw:'X',away:'MS 2'};
  const picks=['home','draw','away'].map(k=>({key:k,label:labels[k],prob:p[k],odd:odds[k],market:market?.[k]??null,edge:market? p[k]-market[k]:0})).sort((a,b)=>b.edge-a.edge);
  const best=picks[0];
  let quality=25;if(market)quality+=20;if(provider)quality+=20;if(pois)quality+=15;if(hh&&ah)quality+=10;if((context.h2h||[]).length)quality+=5;if((fixture?.sidelined||[]).length)quality+=5;quality=clamp(quality,0,100);
  let status='PAS';if(best.edge>=.08&&quality>=60&&base.source!=='market-only')status='VALUE';else if(best.edge>=.04&&quality>=45&&base.source!=='market-only')status='İZLE';

  const signals=[
    {name:'Piyasa oranı',ok:!!market,text:market?`Marj temizlendi (${(market.overround*100).toFixed(1)}%)`:'1-X-2 oranı eksik'},
    {name:'Bağımsız tahmin',ok:!!provider,text:provider?'Sağlayıcı model sinyali mevcut':'Tahmin verisi yok'},
    {name:'Form / gol modeli',ok:!!pois,text:pois?`Poisson ${pois.lh.toFixed(2)}-${pois.la.toFixed(2)}`:'Detay açılınca son maçlarla güçlenir'},
    {name:'H2H',ok:(context.h2h||[]).length>0,text:`${(context.h2h||[]).length} maç`},
    {name:'Eksikler',ok:(fixture?.sidelined||[]).length>0,text:`${(fixture?.sidelined||[]).length} kayıt`}
  ];

  return {teams:{home:home?.name||'Ev',away:away?.name||'Dep'},odds,market,probabilities:p,bestPick:best,status,quality,source:base.source,signals,history:{home:hh,away:ah},expectedGoals:pois?{home:pois.lh,away:pois.la}:null};
}
