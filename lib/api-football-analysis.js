const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const num=v=>{const x=Number(String(v??'').replace('%',''));return Number.isFinite(x)?x:null};
const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!s.length)return null;const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};

function recentStats(rows,teamId){
  let played=0,pts=0,gf=0,ga=0;
  for(const m of rows||[]){
    const st=m?.fixture?.status?.short;if(!['FT','AET','PEN'].includes(st))continue;
    const home=m?.teams?.home?.id===teamId;
    const gfor=home?num(m?.goals?.home):num(m?.goals?.away),gagainst=home?num(m?.goals?.away):num(m?.goals?.home);
    if(gfor===null||gagainst===null)continue;
    played++;gf+=gfor;ga+=gagainst;pts+=gfor>gagainst?3:gfor===gagainst?1:0;if(played>=10)break;
  }
  return played?{played,ppg:pts/played,gf:gf/played,ga:ga/played}:null;
}
function poisson(k,l){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f}
function poissonModel(h,a){
  if(!h||!a)return null;const lh=clamp(((h.gf+a.ga)/2)*1.08,.2,3.8),la=clamp(((a.gf+h.ga)/2)*.96,.18,3.4);
  let home=0,draw=0,away=0;for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const p=poisson(i,lh)*poisson(j,la);if(i>j)home+=p;else if(i===j)draw+=p;else away+=p}
  const t=home+draw+away;return {home:home/t,draw:draw/t,away:away/t,lh,la};
}
function providerPrediction(rows){
  const p=rows?.[0]?.predictions?.percent;if(!p)return null;let h=num(p.home),d=num(p.draw),a=num(p.away);if([h,d,a].some(v=>v===null))return null;const t=h+d+a;if(!t)return null;return {home:h/t,draw:d/t,away:a/t,advice:rows?.[0]?.predictions?.advice||null};
}
function odds1x2(rows){
  const out={home:[],draw:[],away:[]};
  for(const r of rows||[])for(const b of r?.bookmakers||[])for(const bet of b?.bets||[]){
    const name=String(bet?.name||'').toLowerCase();if(!/(match winner|1x2|winner)/.test(name))continue;
    for(const v of bet?.values||[]){const label=String(v?.value||'').toLowerCase(),odd=num(v?.odd);if(!odd||odd<=1)continue;if(/^(home|1)$/.test(label))out.home.push(odd);else if(/^(draw|x)$/.test(label))out.draw.push(odd);else if(/^(away|2)$/.test(label))out.away.push(odd)}
  }
  return {home:median(out.home),draw:median(out.draw),away:median(out.away)};
}
function devig(o){if(!o.home||!o.draw||!o.away)return null;const r={home:1/o.home,draw:1/o.draw,away:1/o.away},t=r.home+r.draw+r.away;return {home:r.home/t,draw:r.draw/t,away:r.away/t,overround:t-1}}
function h2hShift(rows,homeId){
  let d=0,c=0;for(const m of rows||[]){const isHome=m?.teams?.home?.id===homeId;const gf=isHome?num(m?.goals?.home):num(m?.goals?.away),ga=isHome?num(m?.goals?.away):num(m?.goals?.home);if(gf===null||ga===null)continue;d+=gf>ga?1:gf<ga?-1:0;c++;if(c>=8)break}return c?clamp((d/c)*.018,-.018,.018):0;
}
function injuryShift(rows,homeId,awayId){let h=0,a=0;for(const x of rows||[]){const id=x?.team?.id;if(id===homeId)h++;if(id===awayId)a++}return {shift:clamp((a-h)*.006,-.04,.04),home:h,away:a}}
function standingRanks(rows,homeId,awayId){
  const groups=rows?.[0]?.league?.standings||[];const flat=groups.flat();const h=flat.find(x=>x?.team?.id===homeId),a=flat.find(x=>x?.team?.id===awayId);return {home:h?.rank||null,away:a?.rank||null};
}

export function analyzeApiFootball({fixture,predictions,odds,recentHome,recentAway,h2h,injuries,standings}){
  const home=fixture?.teams?.home,away=fixture?.teams?.away;
  const hs=recentStats(recentHome,home?.id),as=recentStats(recentAway,away?.id),pois=poissonModel(hs,as),provider=providerPrediction(predictions),bookOdds=odds1x2(odds),market=devig(bookOdds),inj=injuryShift(injuries,home?.id,away?.id),ranks=standingRanks(standings,home?.id,away?.id);
  let base;if(provider&&pois)base={home:provider.home*.55+pois.home*.45,draw:provider.draw*.55+pois.draw*.45,away:provider.away*.55+pois.away*.45,source:'prediction + poisson'};else if(provider)base={...provider,source:'prediction'};else if(pois)base={...pois,source:'poisson'};else if(market)base={home:market.home,draw:market.draw,away:market.away,source:'market-only'};else base={home:.40,draw:.29,away:.31,source:'fallback'};
  const form=hs&&as?clamp(((hs.ppg-as.ppg)/3)*.055+(((hs.gf-hs.ga)-(as.gf-as.ga))/3)*.03,-.09,.09):0;
  const rankShift=ranks.home&&ranks.away?clamp((ranks.away-ranks.home)*.002,-.025,.025):0;
  const shift=form+h2hShift(h2h,home?.id)+inj.shift+rankShift;
  let p={home:clamp(base.home+shift,.05,.9),away:clamp(base.away-shift*.8,.05,.9),draw:base.draw};p.draw=clamp(1-p.home-p.away,.08,.4);const t=p.home+p.draw+p.away;p={home:p.home/t,draw:p.draw/t,away:p.away/t};
  const labels={home:'MS 1',draw:'X',away:'MS 2'};const picks=['home','draw','away'].map(k=>({key:k,label:labels[k],prob:p[k],odd:bookOdds[k],market:market?.[k]??null,edge:market?p[k]-market[k]:0})).sort((a,b)=>b.edge-a.edge);const best=picks[0];
  let quality=20;if(provider)quality+=18;if(pois)quality+=18;if(market)quality+=20;if((h2h||[]).length)quality+=7;if((injuries||[]).length)quality+=7;if(ranks.home&&ranks.away)quality+=10;quality=clamp(quality,0,100);
  let status='PAS';if(market&&base.source!=='market-only'&&best.edge>=.08&&quality>=60)status='VALUE';else if(market&&base.source!=='market-only'&&best.edge>=.04&&quality>=45)status='İZLE';
  const signals=[
    {name:'Piyasa 1-X-2',ok:!!market,text:market?`Marj temizlendi (${(market.overround*100).toFixed(1)}%)`:'Pre-match 1-X-2 oranı bulunamadı'},
    {name:'API-Football prediction',ok:!!provider,text:provider?(provider.advice||'Olasılık sinyali mevcut'):'Prediction coverage yok'},
    {name:'Son maç / gol modeli',ok:!!pois,text:pois?`Poisson ${pois.lh.toFixed(2)} - ${pois.la.toFixed(2)}`:'Yeterli bitmiş maç verisi yok'},
    {name:'H2H',ok:(h2h||[]).length>0,text:`${(h2h||[]).length} karşılaşma`},
    {name:'Sakatlık kayıtları',ok:(injuries||[]).length>0,text:`Ev ${inj.home} · Dep ${inj.away}`},
    {name:'Lig sıralaması',ok:!!(ranks.home&&ranks.away),text:ranks.home&&ranks.away?`${ranks.home}. vs ${ranks.away}.`:'Bulunamadı'}
  ];
  return {teams:{home:home?.name||'Ev',away:away?.name||'Dep'},odds:bookOdds,market,probabilities:p,bestPick:best,status,quality,source:base.source,signals,history:{home:hs,away:as},expectedGoals:pois?{home:pois.lh,away:pois.la}:null,ranks,providerAdvice:provider?.advice||null};
}
