const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const num=v=>{const s=String(v??'').replace('%','').trim();if(!s)return null;const x=Number(s);return Number.isFinite(x)?x:null};
const norm3=p=>{const h=Math.max(.01,p.home||0),d=Math.max(.01,p.draw||0),a=Math.max(.01,p.away||0),t=h+d+a;return {home:h/t,draw:d/t,away:a/t}};
const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!s.length)return null;const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const outcome=p=>['home','draw','away'].sort((x,y)=>(p[y]||0)-(p[x]||0))[0];

function finishedRow(m,teamId){
  const st=m?.fixture?.status?.short;if(!['FT','AET','PEN'].includes(st))return null;
  const isHome=m?.teams?.home?.id===teamId,isAway=m?.teams?.away?.id===teamId;if(!isHome&&!isAway)return null;
  const gf=isHome?num(m?.goals?.home):num(m?.goals?.away),ga=isHome?num(m?.goals?.away):num(m?.goals?.home);
  if(gf===null||ga===null)return null;
  return {date:m?.fixture?.date||null,isHome,gf,ga,points:gf>ga?3:gf===ga?1:0,opponent:isHome?m?.teams?.away?.name:m?.teams?.home?.name,score:`${m?.goals?.home??'-'}-${m?.goals?.away??'-'}`};
}

function recentStats(rows,teamId,venue='all'){
  const items=(rows||[]).map(m=>finishedRow(m,teamId)).filter(Boolean).filter(x=>venue==='all'||(venue==='home'?x.isHome:!x.isHome)).slice(0,20);
  if(!items.length)return null;
  let wsum=0,pts=0,gf=0,ga=0,w=0,d=0,l=0;
  items.forEach((x,i)=>{const weight=Math.pow(.90,i);wsum+=weight;pts+=x.points*weight;gf+=x.gf*weight;ga+=x.ga*weight;if(x.gf>x.ga)w++;else if(x.gf===x.ga)d++;else l++});
  return {played:items.length,ppg:pts/wsum,gf:gf/wsum,ga:ga/wsum,w,d,l,items:items.slice(0,10)};
}

function poisson(k,l){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f}
function scoreDistribution(lh,la){
  const scores=[];let home=0,draw=0,away=0,over25=0,btts=0,total=0;
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const p=poisson(i,lh)*poisson(j,la);total+=p;if(i>j)home+=p;else if(i===j)draw+=p;else away+=p;if(i+j>=3)over25+=p;if(i>0&&j>0)btts+=p;scores.push({score:`${i}-${j}`,prob:p})}
  scores.sort((a,b)=>b.prob-a.prob);return {probs:norm3({home:home/total,draw:draw/total,away:away/total}),over25:over25/total,btts:btts/total,topScores:scores.slice(0,5).map(x=>({...x,prob:x.prob/total}))};
}
function recentGoalModel(homeAll,awayAll,homeVenue,awayVenue){
  if(!homeAll||!awayAll)return null;
  const h=homeVenue?.played>=3?homeVenue:homeAll,a=awayVenue?.played>=3?awayVenue:awayAll;
  const lh=clamp(((h.gf+a.ga)/2)*1.08,.20,3.8),la=clamp(((a.gf+h.ga)/2)*.96,.18,3.4),dist=scoreDistribution(lh,la);
  return {...dist.probs,lh,la,over25:dist.over25,btts:dist.btts,topScores:dist.topScores,note:`Son dönem ${h.played}/${a.played} maç ve ev/deplasman split`};
}

function teamStatsSummary(raw){
  if(!raw||Array.isArray(raw)&&!raw.length)return null;const r=Array.isArray(raw)?raw[0]:raw;if(!r||!r.fixtures)return null;
  const gfor=r?.goals?.for?.average||{},gagainst=r?.goals?.against?.average||{},played=r?.fixtures?.played||{};
  const read=(obj,k)=>{const v=num(obj?.[k]);return v===null?null:v};
  return {played:read(played,'total'),playedHome:read(played,'home'),playedAway:read(played,'away'),gf:read(gfor,'total'),ga:read(gagainst,'total'),gfHome:read(gfor,'home'),gaHome:read(gagainst,'home'),gfAway:read(gfor,'away'),gaAway:read(gagainst,'away'),form:r?.form||null};
}
function seasonGoalModel(homeStats,awayStats){
  if(!homeStats||!awayStats)return null;
  const hg=homeStats.gfHome??homeStats.gf,ha=homeStats.gaHome??homeStats.ga,ag=awayStats.gfAway??awayStats.gf,aa=awayStats.gaAway??awayStats.ga;
  if([hg,ha,ag,aa].some(v=>v===null||v===undefined))return null;
  const lh=clamp((hg+aa)/2,.20,3.8),la=clamp((ag+ha)/2,.18,3.4),dist=scoreDistribution(lh,la);
  return {...dist.probs,lh,la,over25:dist.over25,btts:dist.btts,topScores:dist.topScores,note:'Sezon ev/deplasman gol ortalamaları'};
}
function blendGoalModels(recent,season){
  if(recent&&season){const p=norm3({home:recent.home*.58+season.home*.42,draw:recent.draw*.58+season.draw*.42,away:recent.away*.58+season.away*.42});return {...p,lh:recent.lh*.58+season.lh*.42,la:recent.la*.58+season.la*.42,over25:recent.over25*.58+season.over25*.42,btts:recent.btts*.58+season.btts*.42,topScores:recent.topScores,note:'Yakın form + sezon ev/deplasman gol modeli'}}
  return recent||season||null;
}

function providerPrediction(rows){
  const p=rows?.[0]?.predictions?.percent;if(!p)return null;let h=num(p.home),d=num(p.draw),a=num(p.away);if([h,d,a].some(v=>v===null))return null;const t=h+d+a;if(!t)return null;return {...norm3({home:h/t,draw:d/t,away:a/t}),advice:rows?.[0]?.predictions?.advice||null};
}
function odds1x2(rows){
  const out={home:[],draw:[],away:[]};
  for(const r of rows||[])for(const b of r?.bookmakers||[])for(const bet of b?.bets||[]){const name=String(bet?.name||'').toLowerCase();if(!/(match winner|1x2|winner)/.test(name))continue;for(const v of bet?.values||[]){const label=String(v?.value||'').toLowerCase(),odd=num(v?.odd);if(!odd||odd<=1)continue;if(/^(home|1)$/.test(label))out.home.push(odd);else if(/^(draw|x)$/.test(label))out.draw.push(odd);else if(/^(away|2)$/.test(label))out.away.push(odd)}}
  return {home:median(out.home),draw:median(out.draw),away:median(out.away),samples:{home:out.home.length,draw:out.draw.length,away:out.away.length}};
}
function devig(o){if(!o.home||!o.draw||!o.away)return null;const raw={home:1/o.home,draw:1/o.draw,away:1/o.away},t=raw.home+raw.draw+raw.away;return {...norm3(raw),overround:t-1,raw}}

function standingsSummary(rows,homeId,awayId){
  const groups=rows?.[0]?.league?.standings||[],flat=groups.flat();
  const map=x=>x?{rank:x.rank||null,points:x.points??null,played:x.all?.played??null,win:x.all?.win??null,draw:x.all?.draw??null,lose:x.all?.lose??null,gf:x.all?.goals?.for??null,ga:x.all?.goals?.against??null,gd:x.goalsDiff??null,ppg:x.all?.played?x.points/x.all.played:null}:null;
  return {home:map(flat.find(x=>x?.team?.id===homeId)),away:map(flat.find(x=>x?.team?.id===awayId))};
}
function strengthModel(standings,homeRecent,awayRecent){
  const h=standings.home,a=standings.away;if(!h||!a)return null;
  const ppgDiff=(h.ppg??0)-(a.ppg??0),gdH=h.played?h.gd/h.played:0,gdA=a.played?a.gd/a.played:0,gdDiff=gdH-gdA,recentDiff=(homeRecent?.ppg??1.5)-(awayRecent?.ppg??1.5);
  const score=clamp(ppgDiff*.70+gdDiff*.45+recentDiff*.20,-2.5,2.5);
  const home=1/(1+Math.exp(-(score+.28))),away=1/(1+Math.exp(score+.28)),draw=clamp(.27-Math.abs(score)*.035,.16,.30);
  const remain=1-draw,ha=home+away;return {...norm3({home:remain*(home/ha),draw,away:remain*(away/ha)}),note:`Lig PPG farkı ${ppgDiff.toFixed(2)}, gol farkı/maç farkı ${gdDiff.toFixed(2)}`};
}

function h2hAdjustment(rows,homeId){
  let d=0,c=0;const list=[];for(const m of rows||[]){const isHome=m?.teams?.home?.id===homeId;const gf=isHome?num(m?.goals?.home):num(m?.goals?.away),ga=isHome?num(m?.goals?.away):num(m?.goals?.home);if(gf===null||ga===null)continue;const ageWeight=Math.pow(.75,c);d+=(gf>ga?1:gf<ga?-1:0)*ageWeight;c++;list.push({date:m?.fixture?.date||null,home:m?.teams?.home?.name,away:m?.teams?.away?.name,score:`${m?.goals?.home??'-'}-${m?.goals?.away??'-'}`});if(c>=8)break}
  return {shift:c?clamp((d/Math.max(1,c))*.012,-.015,.015):0,count:c,list};
}
function injuryImpact(rows,homeId,awayId){
  const weight=x=>{const type=String(x?.player?.type||'').toLowerCase(),reason=String(x?.player?.reason||'').toLowerCase();let w=/suspend|red card|ban/.test(reason)?1.15:/question|doubt|uncertain/.test(type+reason)?.45:1;return clamp(w,.35,1.25)};
  const agg=id=>{const list=(rows||[]).filter(x=>x?.team?.id===id).map(x=>({name:x?.player?.name||'Oyuncu',type:x?.player?.type||'Bilinmiyor',reason:x?.player?.reason||'Belirtilmedi',weight:weight(x)}));const score=list.reduce((s,x)=>s+x.weight,0);return {count:list.length,score,list:list.slice(0,12)}};
  const h=agg(homeId),a=agg(awayId);return {home:h,away:a,shift:clamp((a.score-h.score)*.0025,-.03,.03),note:'Oyuncu dakikası/önemi yoksa sakatlık etkisi güvenlik için ±3 puanla sınırlandırılır.'};
}
function restContext(fixtureDate,homeRows,awayRows,homeId,awayId){
  const now=new Date(fixtureDate).getTime();
  const team=(rows,id)=>{const dates=(rows||[]).map(m=>finishedRow(m,id)).filter(Boolean).map(x=>new Date(x.date).getTime()).filter(t=>Number.isFinite(t)&&t<now).sort((a,b)=>b-a);const rest=dates[0]?Math.max(0,(now-dates[0])/86400000):null,matches7=dates.filter(t=>now-t<=7*86400000).length;return {restDays:rest,matches7}};
  const h=team(homeRows,homeId),a=team(awayRows,awayId);let shift=0;if(h.restDays!=null&&a.restDays!=null)shift+=clamp((h.restDays-a.restDays)*.003,-.012,.012);shift+=clamp((a.matches7-h.matches7)*.005,-.012,.012);return {home:h,away:a,shift:clamp(shift,-.02,.02)};
}

function weightedEnsemble(models){
  const active=models.filter(m=>m.available&&m.probs);const w=active.reduce((s,m)=>s+m.weight,0);if(!w)return null;
  const p={home:0,draw:0,away:0};active.forEach(m=>{p.home+=m.probs.home*m.weight;p.draw+=m.probs.draw*m.weight;p.away+=m.probs.away*m.weight});return {probs:norm3({home:p.home/w,draw:p.draw/w,away:p.away/w}),active};
}

export function analyzeApiFootball({fixture,predictions,odds,recentHome,recentAway,h2h,injuries,standings,teamStatsHome,teamStatsAway}){
  const home=fixture?.teams?.home,away=fixture?.teams?.away,homeAll=recentStats(recentHome,home?.id),awayAll=recentStats(recentAway,away?.id),homeVenue=recentStats(recentHome,home?.id,'home'),awayVenue=recentStats(recentAway,away?.id,'away');
  const recentGoal=recentGoalModel(homeAll,awayAll,homeVenue,awayVenue),homeSeason=teamStatsSummary(teamStatsHome),awaySeason=teamStatsSummary(teamStatsAway),seasonGoal=seasonGoalModel(homeSeason,awaySeason),goal=blendGoalModels(recentGoal,seasonGoal),provider=providerPrediction(predictions),bookOdds=odds1x2(odds),market=devig(bookOdds),standing=standingsSummary(standings,home?.id,away?.id),strength=strengthModel(standing,homeAll,awayAll);
  const models=[
    {id:'provider',name:'API-Football tahmin modeli',available:!!provider,weight:.28,probs:provider?norm3(provider):null,note:provider?.advice||'Sağlayıcı olasılığı'},
    {id:'goals',name:'Gol / Poisson modeli',available:!!goal,weight:.42,probs:goal?norm3(goal):null,note:goal?.note||'Yakın form ve sezon gol profili'},
    {id:'strength',name:'Takım gücü modeli',available:!!strength,weight:.30,probs:strength?norm3(strength):null,note:strength?.note||'Lig sıralaması ve PPG'}
  ];
  const ensemble=weightedEnsemble(models);let p=(ensemble?.probs||market)?{...(ensemble?.probs||market)}:{home:.40,draw:.29,away:.31};
  const hh=h2hAdjustment(h2h,home?.id),inj=injuryImpact(injuries,home?.id,away?.id),rest=restContext(fixture?.fixture?.date,recentHome,recentAway,home?.id,away?.id),adjustment=hh.shift+inj.shift+rest.shift;
  p=norm3({home:clamp(p.home+adjustment,.04,.91),draw:p.draw,away:clamp(p.away-adjustment*.85,.04,.91)});
  const labels={home:'MS 1',draw:'X',away:'MS 2'},picks=['home','draw','away'].map(k=>({key:k,label:labels[k],prob:p[k],odd:bookOdds[k],market:market?.[k]??null,edge:market?p[k]-market[k]:0})).sort((a,b)=>b.edge-a.edge),best=picks[0];
  const independent=ensemble?.active||[],supportCount=market?independent.filter(m=>(m.probs?.[best.key]??0)-(market?.[best.key]??0)>=.02).length:0,modelAgreement=independent.filter(m=>outcome(m.probs)===outcome(p)).length;
  let quality=10;if(market)quality+=15;if(provider)quality+=12;if(goal)quality+=25;if(strength)quality+=20;if(homeAll?.played>=8&&awayAll?.played>=8)quality+=7;if(hh.count>=3)quality+=3;if(injuries?.length)quality+=3;if(rest.home.restDays!=null&&rest.away.restDays!=null)quality+=3;if(homeSeason&&awaySeason)quality+=2;quality=clamp(quality,0,100);
  const sufficiency=quality>=75&&independent.length>=3?'YÜKSEK':quality>=55&&independent.length>=2?'ORTA':'DÜŞÜK';
  let status='PAS',decisionReason='Bağımsız veri/model sayısı yeterli değil.';
  if(market&&independent.length>=3&&supportCount>=2&&best.edge>=.07&&quality>=70){status='VALUE';decisionReason=`${independent.length} bağımsız modelden ${supportCount} tanesi ${best.label} yönünde piyasanın en az 2 puan üzerinde.`}
  else if(market&&independent.length>=2&&supportCount>=1&&best.edge>=.04&&quality>=55){status='İZLE';decisionReason='Edge var ancak VALUE için gereken bağımsız teyit eşiği tamamlanmadı.'}
  else if(!market)decisionReason='Güvenilir 1-X-2 piyasa oranı bulunmadığı için value hesabı yapılamıyor.';

  const marketTable=['home','draw','away'].map(k=>({key:k,label:labels[k],odd:bookOdds[k],market:market?.[k]??null,model:p[k],edge:market?p[k]-market[k]:null}));
  const modelRows=models.map(m=>({id:m.id,name:m.name,available:m.available,weight:m.weight,probs:m.probs,note:m.note,supportsBest:m.available&&market?((m.probs?.[best.key]??0)-(market?.[best.key]??0)>=.02):false}));
  const adjustments=[
    {name:'H2H düzeltmesi',value:hh.shift,note:hh.count?`${hh.count} maç; eski maçların ağırlığı azaltıldı.`:'Veri yok'},
    {name:'Kadro/eksik düzeltmesi',value:inj.shift,note:`Ev ${inj.home.count}, Dep ${inj.away.count}. ${inj.note}`},
    {name:'Dinlenme/yoğunluk',value:rest.shift,note:`Ev ${rest.home.restDays==null?'-':rest.home.restDays.toFixed(1)} gün, Dep ${rest.away.restDays==null?'-':rest.away.restDays.toFixed(1)} gün dinlenme.`}
  ];
  const signals=[
    {name:'Piyasa 1-X-2',ok:!!market,text:market?`Marj ${(market.overround*100).toFixed(1)}% · ${bookOdds.samples.home}/${bookOdds.samples.draw}/${bookOdds.samples.away} oran örneği`:'Pre-match 1-X-2 oranı yok'},
    {name:'Bağımsız model ailesi',ok:independent.length>=3,text:`${independent.length}/3 aktif · ${supportCount} model ${best.label} edge'ini teyit ediyor`},
    {name:'Son 20 maç / gol modeli',ok:!!goal,text:goal?`Poisson λ ${goal.lh.toFixed(2)} - ${goal.la.toFixed(2)}`:'Yeterli gol verisi yok'},
    {name:'Ev/deplasman split',ok:!!(homeVenue&&awayVenue),text:`Ev ${homeVenue?.played||0} · Dep ${awayVenue?.played||0} maç`},
    {name:'H2H',ok:hh.count>0,text:`${hh.count} karşılaşma · düşük ağırlık`},
    {name:'Eksikler',ok:(injuries||[]).length>0,text:`Ev ${inj.home.count} · Dep ${inj.away.count} · etki sınırlandı`},
    {name:'Lig gücü',ok:!!strength,text:standing.home&&standing.away?`${standing.home.rank}. vs ${standing.away.rank}.`:'Bulunamadı'},
    {name:'Dinlenme',ok:rest.home.restDays!=null&&rest.away.restDays!=null,text:`${rest.home.restDays==null?'-':rest.home.restDays.toFixed(1)}g vs ${rest.away.restDays==null?'-':rest.away.restDays.toFixed(1)}g`}
  ];
  return {
    teams:{home:home?.name||'Ev',away:away?.name||'Dep'},odds:bookOdds,market,probabilities:p,bestPick:best,status,quality,dataSufficiency:sufficiency,decisionReason,source:'3-model ensemble',signals,expectedGoals:goal?{home:goal.lh,away:goal.la}:null,
    goalMarkets:goal?{over25:goal.over25,btts:goal.btts,topScores:goal.topScores}:null,
    transparency:{independentModelCount:independent.length,supportCount,modelAgreement,marketTable,models:modelRows,adjustments,final:p,rule:'VALUE = 3 bağımsız model + en az 2 teyit + ≥7 puan edge + kalite ≥70.'},
    raw:{recent:{home:{overall:homeAll,venue:homeVenue},away:{overall:awayAll,venue:awayVenue}},season:{home:homeSeason,away:awaySeason},standings:standing,h2h:hh.list,injuries:{home:inj.home,away:inj.away},rest}
  };
}
