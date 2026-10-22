/* SIMULAB V6 — deterministic historical model and uncertainty-aware Monte Carlo
 * Source inputs: dated final scores, optionally user-submitted historical xG.
 * This is NOT an observed player tracking or match-event model.
 * All forecasts are backtestable, out-of-time; xG values have explicit provenance.
 */
(function(root){
 "use strict";
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
 .replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").replace(/\b(fc|cf|afc|ac|club|football|calcio|the|de|sk|1907)\b/g," ").replace(/\s+/g," ").trim();
 const ALIAS={
 "b dortmund":"borussia dortmund","dortmund":"borussia dortmund",
 "man utd":"manchester united","man united":"manchester united","man city":"manchester city",
 "spurs":"tottenham hotspur","nott m forest":"nottingham forest","wolves":"wolverhampton wanderers",
 "psg":"paris saint germain","paris sg":"paris saint germain","bayern munchen":"bayern munich",
 "bayern munich":"bayern munich","inter":"internazionale","internazionale milano":"internazionale",
 "atleti":"atletico madrid","barca":"barcelona","juve":"juventus","r madrid":"real madrid"
 };
 const keyCache=new Map();
 const key=s=>{
  const raw=String(s||""),cached=keyCache.get(raw);
  if(cached!==undefined)return cached;
  const n=norm(raw),value=ALIAS[n]||n;
  if(keyCache.size>3500)keyCache.clear();
  keyCache.set(raw,value);return value;
 };
 const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))&&!Number.isNaN(Date.parse(s))?s:null;
 const days=(a,b)=>Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);
 const valid=m=>m&&day(m.date)&&key(m.home)&&key(m.away)&&key(m.home)!==key(m.away)&&Number.isInteger(m.hg)&&Number.isInteger(m.ag)&&m.hg>=0&&m.ag>=0&&m.hg<=20&&m.ag<=20;
 const strengthSource=s=>s==="CSV"?5:/football-data/.test(s)?4:/OpenLigaDB/.test(s)?3:/TheSportsDB/.test(s)?2:1;
 function cleanMatches(rows,cutoff){
  const unique=new Map();
  for(const m of rows||[]){
   if(!valid(m)||cutoff&&m.date>=cutoff)continue;
   const id=[m.date,key(m.home),key(m.away)].join("|"),prior=unique.get(id);
   if(!prior||strengthSource(m.source)>strengthSource(prior.source))unique.set(id,m);
  }
  return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||key(a.home).localeCompare(key(b.home)));
 }
 function eloRatings(matches){
  const ratings=new Map(),count=new Map(),hist=[];
  const read=x=>ratings.get(key(x))??1500;
  for(const m of matches){
   const h=read(m.home),a=read(m.away),diff=h+62-a,expect=1/(1+Math.pow(10,-diff/400));
   const actual=m.hg>m.ag?1:m.hg===m.ag?.5:0;
   const margin=Math.min(1.75,1+.24*Math.log1p(Math.abs(m.hg-m.ag)));
   const k=19*margin*(m.date<"2025-01-01"?.82:1);
   const change=k*(actual-expect);
   ratings.set(key(m.home),h+change);ratings.set(key(m.away),a-change);
   count.set(key(m.home),(count.get(key(m.home))||0)+1);
   count.set(key(m.away),(count.get(key(m.away))||0)+1);
   hist.push({date:m.date,home:key(m.home),away:key(m.away),delta:change});
  }
  return {ratings,count,history:hist,get:name=>ratings.get(key(name))??1500};
 }
 function seasonParams(matches,target){
  const recent=matches.slice(-900);
  let h=0,a=0,wt=0;
  for(const m of recent){
   const diff=clamp(days(m.date,target),0,750),w=Math.exp(-diff/370);
   h+=w*m.hg;a+=w*m.ag;wt+=w;
  }
  return {home:(h+20*1.46)/(wt+20),away:(a+20*1.15)/(wt+20),size:recent.length};
 }
 function sideStats(matches,name,target,base,elo){
  const needle=key(name),recent=matches.filter(m=>key(m.home)===needle||key(m.away)===needle).slice(-55);
  let attackSum=0,defenseSum=0,weight=0,home=0,away=0;
  for(const m of recent){
   const isHome=key(m.home)===needle,opp=isHome?m.away:m.home;
   const attackAvg=isHome?base.home:base.away,defenseAvg=isHome?base.away:base.home;
   const oppAdj=clamp(Math.exp((elo.get(opp)-1500)/1600),.77,1.25);
   const w=Math.exp(-clamp(days(m.date,target),0,950)/260);
   attackSum+=w*(isHome?m.hg:m.ag)/(attackAvg*clamp(1/oppAdj,.78,1.28));
   defenseSum+=w*(isHome?m.ag:m.hg)/(defenseAvg*oppAdj);
   weight+=w;if(isHome)home++;else away++;
  }
  const prior=7;
  return {attack:clamp((attackSum+prior)/(weight+prior),.57,1.7),
    defense:clamp((defenseSum+prior)/(weight+prior),.57,1.7),
    total:recent.length,effective:Number(weight.toFixed(1)),home,away};
 }
 function fitRho(matches,base,target){
  if(matches.length<65)return -.07;
  const relevant=matches.slice(-430);
  let best=-.07,scoreBest=-Infinity;
  for(let r=-.18;r<=.081;r+=.02){
   let score=0,validPairs=0;
   for(const m of relevant){
    if(m.hg>1||m.ag>1)continue;
    const lh=base.home,la=base.away;
    const tau=m.hg===0&&m.ag===0?1-r*lh*la:
      m.hg===0&&m.ag===1?1+r*lh:
      m.hg===1&&m.ag===0?1+r*la:1-r;
    if(tau<=0){score=-Infinity;break}
    score+=Math.exp(-clamp(days(m.date,target),0,900)/280)*Math.log(tau);
    validPairs++;
   }
   if(validPairs>=18&&score>scoreBest){scoreBest=score;best=r}
  }
  return clamp(best,-.18,.08);
 }
 function xgInfo(xgRows,team,target){
  const arr=(xgRows||[]).filter(r=>r&&day(r.date)&&r.date<target&&
    Number.isFinite(Number(r.homeXg))&&Number.isFinite(Number(r.awayXg))&&
    Number(r.homeXg)>=0&&Number(r.awayXg)>=0&&(key(r.home)===key(team)||key(r.away)===key(team)))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,24);
  if(!arr.length)return {matches:0,xgf:null,xga:null};
  let f=0,a=0,total=0;
  for(const r of arr){
   const w=Math.exp(-clamp(days(r.date,target),0,1000)/200),home=key(r.home)===key(team);
   f+=w*Number(home?r.homeXg:r.awayXg);a+=w*Number(home?r.awayXg:r.homeXg);total+=w;
  }
  return {matches:arr.length,xgf:f/total,xga:a/total};
 }
 function predict({leagueMatches=[],allMatches=[],home,away,date,xgRows=[]}){
  const target=day(date)||new Date().toISOString().slice(0,10);
  const rows=cleanMatches(leagueMatches,target),all=cleanMatches(allMatches.length?allMatches:leagueMatches,target);
  const elo=eloRatings(all),base=seasonParams(rows,target);
  const h=sideStats(rows,home,target,base,elo),a=sideStats(rows,away,target,base,elo);
  const eloHome=elo.get(home),eloAway=elo.get(away),d=eloHome-eloAway;
  const discount=clamp(Math.min(h.total,a.total)/15,.15,1);
  const eloFactor=clamp(Math.exp((d/1200)*.28*discount),.88,1.14);
  let lh=clamp(base.home*(h.attack*.60+a.defense*.40)*eloFactor,.22,3.7);
  let la=clamp(base.away*(a.attack*.60+h.defense*.40)/eloFactor,.18,3.6);
  const xh=xgInfo(xgRows,home,target),xa=xgInfo(xgRows,away,target);
  const bothXg=xh.matches>=4&&xa.matches>=4;
  if(bothXg){
   const expectedH=clamp(xh.xgf*.6+xa.xga*.4,.25,3.8);
   const expectedA=clamp(xa.xgf*.6+xh.xga*.4,.22,3.7);
   const xgWeight=clamp(Math.min(xh.matches,xa.matches)/20,0,.27);
   lh=lh*(1-xgWeight)+expectedH*xgWeight;
   la=la*(1-xgWeight)+expectedA*xgWeight;
  }
  const rho=fitRho(rows,base,target);
  const latest=rows.at(-1)?.date||null,age=latest?days(latest,target):999;
  return {home:lh,away:la,rho,eloHome,eloAway,eloGap:d,teamHome:h,teamAway:a,leagueBase:base,
    historyCount:rows.length,allHistoryCount:all.length,latestResult:latest,ageDays:age,
    xgHome:xh,xgAway:xa,xgUsed:bothXg,target,
    quality:h.total>=12&&a.total>=12&&age<=14?"ORTA":h.total>=6&&a.total>=6&&age<=30?"DÜŞÜK–ORTA":"DÜŞÜK",
    notes:["Gol ortalamaları gerçek maç skorlarından tahmin edilir; doğrudan xG değildir.",
    "Elo puanları sadece kesim tarihinden önce oynanan maçlarla hesaplanır.",
    "Dixon–Coles düzeltmesi özellikle 0-0, 1-0, 0-1 ve 1-1 skorlarının beraber dağılımını değiştirir.",
    bothXg?"Kullanıcının sağladığı geçmiş xG kayıtları sınırlı ağırlıkla kullanıldı.":"Kaynaklı maç xG verisi yok: xG etkisi uygulanmadı."]};
 }
 const factorial=[1];for(let i=1;i<=15;i++)factorial[i]=factorial[i-1]*i;
 function poisson(lam,k){return Math.exp(-lam)*Math.pow(lam,k)/factorial[k]}
 function grid(lh,la,rho){
  lh=clamp(Number(lh)||1.4,.15,4.3);la=clamp(Number(la)||1.2,.15,4.3);
  rho=clamp(Number.isFinite(rho)?rho:-.07,-.18,.08);
  const entries=[];let sum=0;
  for(let h=0;h<=11;h++)for(let a=0;a<=11;a++){
   let correction=1;
   if(h===0&&a===0)correction=1-rho*lh*la;
   else if(h===0&&a===1)correction=1+rho*lh;
   else if(h===1&&a===0)correction=1+rho*la;
   else if(h===1&&a===1)correction=1-rho;
   const p=Math.max(0,poisson(lh,h)*poisson(la,a)*correction);
   entries.push({h,a,p});sum+=p;
  }
  let total=0,outcomes=[0,0,0],top=[];
  for(const e of entries){
   e.p/=sum;total+=e.p;e.cdf=total;
   outcomes[e.h>e.a?0:e.h===e.a?1:2]+=e.p;
   top.push({h:e.h,a:e.a,p:e.p});
  }
  top.sort((x,y)=>y.p-x.p);
  return {entries,probs:outcomes,top:top.slice(0,8),goalMeans:[lh,la],rho};
 }
 function sample(distribution,rng=Math.random){
  const entries=distribution.entries,v=Math.min(.999999999999,Math.max(0,rng()));
  let low=0,high=entries.length-1;
  while(low<high){const middle=(low+high)>>1;if(entries[middle].cdf>=v)high=middle;else low=middle+1}
  return [entries[low].h,entries[low].a];
 }
 function tacticFactors(tactics={}){
  // Assumed bounded scenario effects, NOT trained tactical observations.
  const hp=tactics.homePress||"normal",ap=tactics.awayPress||"normal";
  const hs=tactics.homeStyle||"balanced",as=tactics.awayStyle||"balanced";
  const pressure={high:.025,normal:0,low:-.015};
  const vulnerability={high:.014,normal:0,low:-.012};
  const openness=style=>style==="direct"?.025:style==="possession"?.008:style==="counter"?.018:0;
  let home=pressure[hp]+vulnerability[ap]+openness(hs)+(as==="counter"&&hp==="high"?-.025:0);
  let away=pressure[ap]+vulnerability[hp]+openness(as)+(hs==="counter"&&ap==="high"?-.025:0);
  return {home:clamp(home,-.075,.075),away:clamp(away,-.075,.075),
   description:"Taktik ayarları şimdilik varsayımsal küçük etkilerdir; gerçek pres ve pas olaylarıyla kalibre edilmemiştir."};
 }
 function metrics(pred,outcome){
  const expected=[outcome===0?1:0,outcome===1?1:0,outcome===2?1:0];
  let brier=0;for(let i=0;i<3;i++)brier+=Math.pow(pred[i]-expected[i],2);
  return {brier:brier/3,logLoss:-Math.log(Math.max(.000001,pred[outcome]))};
 }
 function backtest({leagueMatches=[],allMatches=[],xgRows=[],maxGames=130,minTrain=75}){
  const rows=cleanMatches(leagueMatches),all=cleanMatches(allMatches.length?allMatches:leagueMatches);
  if(rows.length<minTrain+10)return {error:"Bu turnuvada zaman sıralı test için yeterli maç bulunamadı.",required:minTrain+10,available:rows.length};
  const dates=[...new Set(rows.map(x=>x.date))];
  const tests=rows.filter(m=>rows.findIndex(r=>r.date===m.date)>=minTrain).slice(-Math.max(20,Math.min(250,maxGames)));
  let totals={brier:0,logLoss:0,baselineBrier:0,baselineLogLoss:0,hit:0},validN=0;
  const bins=[{low:0,high:.4,n:0,p:0,correct:0},{low:.4,high:.5,n:0,p:0,correct:0},
   {low:.5,high:.6,n:0,p:0,correct:0},{low:.6,high:.7,n:0,p:0,correct:0},{low:.7,high:1.01,n:0,p:0,correct:0}];
  const predictions=[];
  for(const match of tests){
   const training=rows.filter(m=>m.date<match.date);
   if(training.length<minTrain)continue;
   const history=all.filter(m=>m.date<match.date);
   const estimate=predict({leagueMatches:training,allMatches:history,home:match.home,away:match.away,
    date:match.date,xgRows:xgRows.filter(r=>r.date<match.date)});
   const distribution=grid(estimate.home,estimate.away,estimate.rho);
   const probs=distribution.probs,actual=match.hg>match.ag?0:match.hg===match.ag?1:2;
   const m=metrics(probs,actual);
   // Rolling league-specific prior baseline: only earlier matches, with light shrinkage.
   const window=training.slice(-140),count=[7,5,6];
   for(const prev of window)count[prev.hg>prev.ag?0:prev.hg===prev.ag?1:2]++;
   const denom=count.reduce((a,b)=>a+b,0),ref=count.map(x=>x/denom);
   const baseline=metrics(ref,actual);
   totals.brier+=m.brier;totals.logLoss+=m.logLoss;
   totals.baselineBrier+=baseline.brier;totals.baselineLogLoss+=baseline.logLoss;
   const favorite=probs.indexOf(Math.max(...probs)),top=probs[favorite],correct=favorite===actual?1:0;
   totals.hit+=correct;
   const bin=bins.find(b=>top>=b.low&&top<b.high);
   if(bin){bin.n++;bin.p+=top;bin.correct+=correct}
   validN++;
   predictions.push({date:match.date,home:match.home,away:match.away,
    hg:match.hg,ag:match.ag,probs:probs.map(p=>Number(p.toFixed(4))),predicted:favorite,actual,confidence:top});
  }
  if(validN<20)return {error:"Test döneminde yeterli geçmiş maç yok.",tested:validN};
  const ratio=x=>Number((x/validN).toFixed(4));
  return {tested:validN,firstDate:predictions[0].date,lastDate:predictions.at(-1).date,
   brier:ratio(totals.brier),logLoss:ratio(totals.logLoss),
   baselineBrier:ratio(totals.baselineBrier),baselineLogLoss:ratio(totals.baselineLogLoss),
   hitRate:ratio(totals.hit),
   calibration:bins.filter(b=>b.n>0).map(b=>({range:Math.round(b.low*100)+"–"+Math.round(Math.min(b.high,1)*100)+"%",n:b.n,p:Number((b.p/b.n).toFixed(3)),observed:Number((b.correct/b.n).toFixed(3))})),
   predictions:predictions.slice(-12),
   methodology:"Kesim tarihinden sonraki skorlar eğitimde kullanılmadı. Aynı gün oynanan maçlar da dışlandı. Brier 3 sınıf ortalamasıdır; küçük değer daha iyi. Referans, her test maçı öncesindeki son 140 lig sonucundan hesaplanan ev/beraberlik/deplasman sıklığıdır ve geçmiş veri dışında bilgi kullanmaz. Sonuçlar veri kapsamına bağlıdır."};
 }
 const api={norm,key,cleanMatches,eloRatings,predict,grid,sample,tacticFactors,backtest,xgInfo,metrics};
 root.SIMULAB_ENGINE_V6=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
