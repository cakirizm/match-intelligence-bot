/* SIMULAB V2 — free football analytics; no commercial APIs required.
   Public data: OpenFootball (CC0). Optional football-data.org FREE API.
   Context, news and player inputs are explicitly model scenarios, not verified facts. */
(() => {
"use strict";
const LEAGUES=[
  {id:"eng",short:"en",api:"PL",flag:"🇬🇧",name:"Premier League"},
  {id:"esp",short:"es",api:"PD",flag:"🇪🇸",name:"La Liga"},
  {id:"ger",short:"de",api:"BL1",flag:"🇩🇪",name:"Bundesliga"},
  {id:"ita",short:"it",api:"SA",flag:"🇮🇹",name:"Serie A"},
  {id:"fra",short:"fr",api:"FL1",flag:"🇫🇷",name:"Ligue 1"}
];
const SEASONS=["2026-27","2025-26","2024-25","2023-24","2022-23"];
const LS={matches:"simulab-v1",fixtures:"simulab-fixtures-v1",meta:"simulab-metadata-v1",lineups:"simulab-v2-lineups",context:"simulab-v2-context",approvals:"simulab-v2-news-approvals"};
const FORMS={"4-3-3":["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"],"4-2-3-1":["GK","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW"],"4-4-2":["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"],"3-5-2":["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"]};
const POSITION={GK:"KL",DF:"DF",MF:"OS",FW:"FV"};
const $=id=>document.getElementById(id);
const read=key=>{try{const o=JSON.parse(localStorage.getItem(key)||"{}");return o&&typeof o==="object"&&!Array.isArray(o)?o:{}}catch{return {}}};
const persist=(key,o)=>{try{localStorage.setItem(key,JSON.stringify(o));return true}catch{notify("Tarayıcı depolama sınırına ulaşıldı; bilgiler kaydedilemedi.",true);return false}};
let matches=read(LS.matches),fixtures=read(LS.fixtures),metadata=read(LS.meta),lineups=read(LS.lineups),contexts=read(LS.context),approvals=read(LS.approvals);
let league="eng",chosen=null,fixtureFilter="upcoming",speed=100,runToken=0,newsToken=0,syncing=false,newsCache={},tab="match";
const dateToday=()=>new Date().toISOString().slice(0,10); // UTC date - independent of client locale
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))&&!Number.isNaN(Date.parse(s));
const fmtDate=s=>isDate(s)?s.slice(8,10)+"."+s.slice(5,7)+"."+s.slice(0,4):"—";
const days=(a,b)=>Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const pct=n=>(n*100).toFixed(1)+"%";
const text=(node,value)=>{node.textContent=String(value);return node};
const node=(tag,cls,str)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(str!==undefined)n.textContent=String(str);return n};
const leagueObj=()=>LEAGUES.find(l=>l.id===league);
const normalized=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[&]/g," and ").replace(/[^a-z0-9 ]+/g," ").replace(/\b(fc|cf|afc|sc|club|football|futbol|de|the|a|ac|as|calcio|1907)\b/g," ").replace(/\s+/g," ").trim();
function canonical(name,key){
  const own=(matches[key]||[]).flatMap(m=>[m.home,m.away]);
  const names=[...new Set(own)];
  if(names.includes(name))return name;
  const n=normalized(name);
  if(!n)return name;
  const exact=names.find(s=>normalized(s)===n);
  if(exact)return exact;
  // High-confidence match only; avoid silently merging unrelated club names.
  const words=new Set(n.split(" "));
  const candidates=names.map(original=>{
    const w=new Set(normalized(original).split(" ")),intersection=[...words].filter(x=>w.has(x)).length;
    return {name:original,score:intersection/(new Set([...w,...words]).size||1)};
  }).filter(x=>x.score>=.86).sort((a,b)=>b.score-a.score);
  return candidates.length===1?candidates[0].name:name;
}
function notify(message,warn=false){const banner=$("source-banner");if(banner){banner.textContent=message;banner.classList.toggle("warn",warn)}}
const results=()=>Array.isArray(matches[league])?matches[league]:[];
const upcoming=()=>Array.isArray(fixtures[league])?fixtures[league]:[];
function teams(){
 return [...new Set([...results().flatMap(x=>[x.home,x.away]),...upcoming().flatMap(x=>[x.home,x.away])])].filter(Boolean).sort((a,b)=>a.localeCompare(b,"tr"));
}
function makeOpts(sel,values,prior){
 sel.replaceChildren();
 if(!values.length){const opt=node("option",null,"Veri bulunamadı");opt.value="";sel.append(opt);return}
 for(const value of values){const opt=node("option",null,value);opt.value=value;sel.append(opt)}
 if(values.includes(prior))sel.value=prior;
}
function currentPair(){return {home:$("team-home").value,away:$("team-away").value}}
function pairKey(team){return league+"|"+team}
function fixtureKey(f){return [f.date,f.home,f.away].join("|")}
function currentRows(){return results().filter(x=>x&&isDate(x.date)&&Number.isInteger(x.hg)&&Number.isInteger(x.ag))}
function fixtureRows(){
 const list=[],seen=new Set();
 for(const x of upcoming()){
  if(!x||!x.home||!x.away||!isDate(x.date))continue;
  const k=fixtureKey(x);if(seen.has(k))continue;seen.add(k);list.push({...x,isResult:false})
 }
 for(const x of currentRows()){
  const k=fixtureKey(x);if(seen.has(k)){const i=list.findIndex(r=>fixtureKey(r)===k);if(i>=0)list.splice(i,1)}
  seen.add(k);list.push({...x,isResult:true})
 }
 return list;
}
function renderLeagues(){
 const root=$("leagues");root.replaceChildren();
 for(const l of LEAGUES){
  const b=node("button","league"+(league===l.id?" selected":""));
  const f=node("span","flag",l.flag),wrap=node("span"),n=node("strong",null,l.name),s=node("small",null,(matches[l.id]?.length||0).toLocaleString("tr-TR")+" maç");
  wrap.append(n,s);b.append(f,wrap);b.addEventListener("click",()=>setLeague(l.id));root.append(b);
 }
}
function syncBanner(){
 const m=metadata[league],list=currentRows(),latest=list.map(x=>x.date).sort().at(-1);
 const count=Object.values(matches).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0);
 text($("total-games"),count.toLocaleString("tr-TR"));
 text($("status-top"),m?.updatedAt?"Kontrol: "+new Date(m.updatedAt).toLocaleDateString("tr-TR"):"Henüz kontrol edilmedi");
 if(!latest){
  notify(leagueObj().name+" için gerçek skor bulunmuyor. Sağ üstten Verileri Güncelle seçeneğini kullanın.",true);
  text($("data-summary"),"Bu lig için tamamlanmış sonuç yok.");
  return;
 }
 const age=days(latest,dateToday()),stale=age>14;
 const source=m?.source||"Kaydedilmiş geçmiş veri";
 const message=(stale?"⚠ SONUÇLAR ESKİ • ":"✓ MAÇ ARŞİVİ • ")+leagueObj().name+" · "+list.length+" maç · En son doğrulanmamış kaynak sonucu: "+fmtDate(latest)+" ("+age+" gün önce) · "+source+
 (stale?" · Güncel sezon bilgisi eksik olabilir.":"");
 notify(message,stale);
 text($("data-summary"),leagueObj().name+" · "+list.length+" tamamlanmış maç · "+upcoming().length+" fikstür kaydı · en son skor "+fmtDate(latest)+". Kaynak senkronizasyonu "+(m?.updatedAt?new Date(m.updatedAt).toLocaleString("tr-TR"):"bilinmiyor")+". En son skor tarihi kaynak tarafından sunulur; manuel doğrulama yapılmamıştır.");
}
function setLeague(id){
 if(!LEAGUES.some(l=>l.id===id))return;
 league=id;chosen=null;runToken++;newsToken++;newsCache={};
 renderLeagues();
 const available=teams();makeOpts($("team-home"),available);makeOpts($("team-away"),available,available[1]||available[0]);
 updateSelectedUI();renderFixtures();syncBanner();
}
function setTab(name){
 tab=name;document.querySelectorAll("#tabs [data-tab]").forEach(b=>b.classList.toggle("selected",b.dataset.tab===name));
 document.querySelectorAll(".tabpage").forEach(x=>x.classList.toggle("selected",x.id==="page-"+name));
 if(name==="news")renderNews();
 if(name==="lineup")renderLineups();
 if(name==="match")renderFixtures();
 if(name==="method")syncBanner();
}
function updateSelectedUI(){
 const {home,away}=currentPair();
 text($("selected-match").firstElementChild,chosen?(fmtDate(chosen.date)+(chosen.time?" · "+chosen.time:"")+" • "+(chosen.isResult?"Oynanmış maç (geriye dönük)": "Gelecek fikstür")):"Eşleşme seç ve simüle et.");
 text($("news-home-title"),home?home+" • Haberler":"Ev sahibi haberleri");
 text($("news-away-title"),away?away+" • Haberler":"Deplasman haberleri");
 renderForms();renderLineups();renderPsych();
}
function chooseFixture(m){
 const available=teams();
 if(!available.includes(m.home)||!available.includes(m.away)){notify("Seçili maçın takımları arşivde bulunamadı.",true);return}
 $("team-home").value=m.home;$("team-away").value=m.away;
 chosen=m;runToken++;newsCache={};newsToken++;
 updateSelectedUI();setTab("match");
 $("simulate").scrollIntoView({behavior:"smooth",block:"center"});
 setTimeout(()=>simulate(),150);
 loadNews();
}
function renderFixtures(){
 const box=$("fixture-list"),list=fixtureRows(),today=dateToday();box.replaceChildren();
 let subset=list.filter(m=>fixtureFilter==="upcoming"?!m.isResult&&m.date>=today:fixtureFilter==="results"?m.isResult:true);
 const query=$("fixture-search").value.trim().toLocaleLowerCase("tr");
 if(query)subset=subset.filter(m=>(m.home+" "+m.away).toLocaleLowerCase("tr").includes(query));
 subset.sort((a,b)=>fixtureFilter==="results"?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
 if(fixtureFilter==="all")subset.sort((a,b)=>b.date.localeCompare(a.date));
 const total=subset.length,limit=Number($("fixture-limit").value)||12;subset=subset.slice(0,limit);
 text($("fixture-footnote"),total+" maç bulundu · Tıkla → 1.000 simülasyon · Skorsuz geçmiş tarihler sonuç olarak gösterilmez.");
 if(!subset.length){
  const empty=node("div","placeholder",fixtureFilter==="upcoming"?"Kaynakta güncel fikstür yok. Veri eski olabilir; OpenFootball güncellemesini veya ücretsiz API bağlantısını deneyin.":"Eşleşen maç yok.");box.append(empty);return;
 }
 for(const m of subset){
  const b=node("button","fixture-item"+(chosen&&fixtureKey(chosen)===fixtureKey(m)?" active":""));
  const date=node("span","fixture-date-mini");date.append(node("b",null,fmtDate(m.date)),node("span",null,m.time||""));
  const t=node("span","fixture-teams",m.home+"  —  "+m.away);
  const score=node("span","fixture-score",m.isResult?m.hg+" : "+m.ag:"SİMÜLE ET ↗");
  b.append(date,t,score);b.addEventListener("click",()=>chooseFixture(m));box.append(b);
 }
 if(total>limit)box.append(node("p","fixture-more",total-limit+" maç daha var. Filtreyi veya maç sayısını değiştir."));
}
function playedBefore(date){
 return currentRows().filter(m=>!date||m.date<date).sort((a,b)=>b.date.localeCompare(a.date));
}
function teamLast(team,max=5,date){
 return playedBefore(date).filter(m=>m.home===team||m.away===team).slice(0,max);
}
function teamForm(team,date){
 const last=teamLast(team,5,date),out={w:0,d:0,l:0,gf:0,ga:0,n:last.length,lastDate:last[0]?.date||null};
 for(const m of last){
  const home=m.home===team,scored=home?m.hg:m.ag,against=home?m.ag:m.hg;
  out.gf+=scored;out.ga+=against;if(scored>against)out.w++;else if(scored===against)out.d++;else out.l++;
 }
 return out;
}
function renderForms(){
 const {home,away}=currentPair(),box=$("form-comparison");box.replaceChildren();
 const wrap=node("div","form-row");
 for(const t of [home,away]){
  if(!t)continue;
  const form=teamForm(t,chosen?.date),el=node("div","form-team");el.append(node("h3",null,t));
  const tags=node("div","form-tags");
  const rec=teamLast(t,5,chosen?.date).reverse();
  for(const match of rec){
   const h=match.home===t,goals=h?match.hg:match.ag,conceded=h?match.ag:match.hg,grade=goals>conceded?"W":goals===conceded?"D":"L";
   tags.append(node("b",grade,grade==="W"?"G":grade==="D"?"B":"M"));
  }
  if(!rec.length)tags.append(node("span","placeholder","Veri yok"));
  el.append(tags,node("p",null,form.w+"G / "+form.d+"B / "+form.l+"M · "+form.gf+"-"+form.ga+" gol"),node("p",null,"Son kayıt: "+fmtDate(form.lastDate)));wrap.append(el);
 }
 box.append(wrap);
}
function makeContext(team){
 const k=pairKey(team);
 if(!contexts[k])contexts[k]={morale:0,pressure:0,fatigue:0};
 return contexts[k];
}
function lineupFor(team){
 const key=pairKey(team);
 if(!lineups[key])lineups[key]={formation:"4-3-3",players:[]};
 const item=lineups[key];
 if(!FORMS[item.formation])item.formation="4-3-3";
 if(!Array.isArray(item.players))item.players=[];
 while(item.players.length<11)item.players.push({name:"",rating:6.5,fitness:100});
 item.players=item.players.slice(0,11).map(p=>({name:String(p.name||"").slice(0,60),rating:clamp(Number(p.rating)||6.5,1,10),fitness:clamp(Number(p.fitness)||100,50,100)}));
 return item;
}
function makeLineupPanel(side,team){
 const root=$("lineup-"+side);root.replaceChildren();
 if(!team){root.append(node("p","placeholder","Takım seçilmedi"));return}
 const data=lineupFor(team),header=node("div","panel-head"),left=node("div");
 left.append(node("small","eyebrow",side==="home"?"EV SAHİBİ / 11":"DEPLASMAN / 11"),node("h2",null,team));
 const formation=node("select");
 formation.setAttribute("aria-label",team+" diziliş");
 for(const key of Object.keys(FORMS)){const opt=node("option",null,key);opt.value=key;formation.append(opt)}
 formation.value=data.formation;
 formation.addEventListener("change",()=>{data.formation=formation.value;persist(LS.lineups,lineups);renderLineups()});
 header.append(left,formation);root.append(header);
 const labels=node("div","lineup-row lineup-row-head");
 labels.append(node("span",null,"MEVKİ"),node("span",null,"OYUNCU ADI"),node("span",null,"PUAN /10"),node("span",null,"HAZIR %"));root.append(labels);
 const pos=FORMS[data.formation];
 for(let i=0;i<11;i++){
  const player=data.players[i],line=node("div","lineup-row");
  const p=node("small",null,POSITION[pos[i]]);line.append(p);
  const name=node("input");name.type="text";name.maxLength=60;name.placeholder=(i+1)+". oyuncu";name.value=player.name;name.setAttribute("aria-label",team+" "+(i+1)+". oyuncu");
  const rating=node("input");rating.type="number";rating.min="1";rating.max="10";rating.step="0.5";rating.value=player.rating;rating.setAttribute("aria-label",team+" "+(i+1)+". puanı");
  const fitness=node("input");fitness.type="number";fitness.min="50";fitness.max="100";fitness.step="5";fitness.value=player.fitness;fitness.setAttribute("aria-label",team+" "+(i+1)+". hazır oluşu");
  const save=()=>{player.name=name.value.trim().slice(0,60);player.rating=clamp(Number(rating.value)||6.5,1,10);player.fitness=clamp(Number(fitness.value)||100,50,100);persist(LS.lineups,lineups);updateSummary()};
  name.addEventListener("input",save);rating.addEventListener("change",save);fitness.addEventListener("change",save);
  line.append(name,rating,fitness);root.append(line);
 }
 const summary=node("div","lineup-summary");root.append(summary);
 const help=node("p","lineup-help","İsimler ve puanlar tarayıcında kaydedilir. Oyuncu bilgisi doğrulanmış veri değildir.");root.append(help);
 function updateSummary(){
  const count=data.players.filter(x=>x.name).length,eff=lineupEffect(team);
  summary.replaceChildren(node("span",null,count+"/11 girilmiş oyuncu"),node("b",null,"Hücum "+signed(eff.attack)+" · Savunma "+signed(eff.defense)));
 }
 updateSummary();
}
function renderLineups(){const {home,away}=currentPair();makeLineupPanel("home",home);makeLineupPanel("away",away)}
const signed=n=>(n>=0?"+":"")+(100*n).toFixed(1)+"%";
function lineupEffect(team){
 const x=lineupFor(team),positions=FORMS[x.formation];let totalA=0,totalD=0,attack=0,defense=0,filled=0;
 const weights={GK:[.1,1.7],DF:[.35,1.45],MF:[1,1],FW:[1.8,.25]};
 for(let i=0;i<11;i++){
  const w=weights[positions[i]],[pA,pD]=w,p=x.players[i];
  totalA+=pA;totalD+=pD;
  if(!p.name)continue;
  filled++;
  const diff=(p.rating-6.5)/3.5,condition=(p.fitness-100)/50;
  attack+=(diff*.125+condition*.07)*pA;
  defense+=(diff*.125+condition*.07)*pD;
 }
 return {attack:clamp(attack/totalA,-.14,.14),defense:clamp(defense/totalD,-.14,.14),filled};
}
function renderPsych(){
 const {home,away}=currentPair();
 const ins=$("psych-insights"),controls=$("psych-controls");ins.replaceChildren();controls.replaceChildren();
 for(const team of [home,away]){
  if(!team)continue;
  const f=teamForm(team,chosen?.date),last=f.lastDate,daysOff=chosen?.date&&last?days(last,chosen.date):null;
  const item=node("div","insight");
  item.append(node("h3",null,team),node("p",null,"Son 5 maç: "+f.w+" galibiyet, "+f.d+" beraberlik, "+f.l+" mağlubiyet. Gol farkı "+(f.gf-f.ga>0?"+":"")+(f.gf-f.ga)+"."),node("p",null,daysOff===null?"Dinlenme süresi: veri yok":daysOff<0?"Tarih eşleşmesi kontrol edilmeli":"Fikstüre göre son bilinen maçtan bu yana "+daysOff+" gün."));
  item.append(node("p",null,(f.n?"Formdan hesaplanan motivasyon/özgüven vekil göstergesi: "+(f.w>f.l?"olumlu":f.w<f.l?"olumsuz":"nötr")+". ":"Veri yetersiz. ")+"Bu, gerçek psikolojik ölçüm değildir."));
  if(last&&days(last,dateToday())>14)item.append(node("p",null,"⚠ Son maç kaydı "+fmtDate(last)+" — güncel form ve yorgunluk kesin değildir."));
  ins.append(item);
  const c=makeContext(team),set=node("div","slider-set");
  set.append(node("div","slider-title",team));
  for(const [key,label] of [["morale","Moral senaryosu"],["pressure","Baskıyla başa çıkma"],["fatigue","Fiziksel hazır oluş"]]){
   const row=node("div","slider-row"),l=node("label",null,label),range=node("input"),v=node("b",null,Number(c[key])>0?"+"+c[key]:c[key]);
   range.type="range";range.min="-3";range.max="3";range.step="1";range.value=c[key];
   range.setAttribute("aria-label",team+" "+label);
   range.addEventListener("input",()=>{c[key]=Number(range.value);v.textContent=c[key]>0?"+"+c[key]:String(c[key]);persist(LS.context,contexts)});
   row.append(l,range,v);set.append(row);
  }
  controls.append(set);
 }
}
function headlineSignal(title){
 const s=String(title||"").toLowerCase();
 if(/\b(injury|injured|injuries|sidelined|ruled out|out for|hamstring|knee injury|ankle injury|fitness doubt|doubtful)\b/.test(s))return {label:"Olası sakatlık/kadro riski",note:"Başlıktaki kadro riski teyit edilirse olumsuz senaryo.",impact:-.025,kind:"risk"};
 if(/\b(suspended|suspension|banned|red card|ban)\b/.test(s))return {label:"Olası ceza/eksik",note:"Oyuncunun takım ve maç uygunluğunu doğrulayın.",impact:-.028,kind:"risk"};
 if(/\b(return|returns|back in training|available|fully fit|cleared to play|comeback)\b/.test(s))return {label:"Olası kadro dönüşü",note:"Dönen kişinin oynayacağı kesin değildir.",impact:.017,kind:"positive"};
 if(/\b(crisis|under pressure|sacked|dismissed|dressing room|losing streak)\b/.test(s))return {label:"Takım baskısı/teknik ekip haberi",note:"Başlığın anlamı doğrulanmadan ruh hâli çıkarılamaz.",impact:-.012,kind:"context"};
 if(/\b(winning streak|unbeaten|boost|confidence)\b/.test(s))return {label:"Olası olumlu atmosfer",note:"Bir haber başlığı özgüveni kesin olarak ölçmez.",impact:.012,kind:"positive"};
 return {label:"Genel takım haberi",note:"Doğrudan model etkisi önerilmedi.",impact:0,kind:"neutral"};
}
function validLink(uri){try{const u=new URL(uri);return u.protocol==="https:"&&["news.google.com","www.google.com"].includes(u.hostname)}catch{return false}}
function cacheKey(team){return league+"|"+team}
function newsEffect(team){
 const articles=newsCache[cacheKey(team)]?.items||[],seen=new Set();let effect=0,count=0;
 for(const article of articles){
  const key=cacheKey(team)+"|"+article.title;
  if(approvals[key]&&!seen.has(key)){const signal=headlineSignal(article.title);effect+=signal.impact;count++;seen.add(key)}
 }
 return {effect:clamp(effect,-.08,.08),count};
}
function renderNews(){
 const {home,away}=currentPair();
 for(const [side,team] of [["home",home],["away",away]]){
  text($("news-"+side+"-title"),team||"Takım seçilmedi");
  const root=$("news-"+side+"-list");root.replaceChildren();
  if(!team){root.append(node("p","placeholder","Önce takım seçin."));continue}
  const cache=newsCache[cacheKey(team)];
  if(!cache){root.append(node("p","placeholder","Haberleri getirmek için yukarıdaki butonu kullanın."));continue}
  if(cache.error){root.append(node("p","placeholder",cache.error));continue}
  if(!cache.items?.length){root.append(node("p","placeholder","Son dönemde ilgili başlık bulunamadı."));continue}
  for(const item of cache.items){
   const card=node("div","news-entry"),link=node("a",null,item.title);
   if(validLink(item.url)){link.href=item.url;link.target="_blank";link.rel="noopener noreferrer"}
   else link.removeAttribute("href");
   card.append(link);
   const d=node("div","news-meta");
   d.append(node("span",null,item.source||"Haber kaynağı"),node("span",null,item.published?new Date(item.published).toLocaleString("tr-TR"):"Tarih bilinmiyor"));
   card.append(d);
   const signal=headlineSignal(item.title),description=node("div","news-tag",signal.label+" · "+signal.note);
   card.append(description);
   const key=cacheKey(team)+"|"+item.title,check=node("input");check.type="checkbox";check.checked=!!approvals[key];check.disabled=signal.impact===0;
   const label=node("label");label.append(check,node("span",null,signal.impact===0?"Model etkisi yok — kaynak için haberi oku":"Bu yorumu onayla, modele dahil et ("+signed(signal.impact)+")"));
   check.addEventListener("change",()=>{if(check.checked)approvals[key]=true;else delete approvals[key];persist(LS.approvals,approvals)});
   card.append(label);root.append(card);
  }
 }
}
async function fetchJson(url,timeout=12000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const r=await fetch(url,{signal:controller.signal,cache:"no-store"});let data;try{data=await r.json()}catch{throw Error("Geçersiz JSON yanıtı")}
  if(!r.ok)throw Error(data?.error||"HTTP "+r.status);
  return data;
 }finally{clearTimeout(timer)}
}
async function loadNews(){
 const {home,away}=currentPair();
 if(!home||!away||home===away)return;
 const thisRun=++newsToken,targets=[home,away];
 text($("news-status"),"Kaynak başlıkları aranıyor...");
 await Promise.all(targets.map(async team=>{
   try{
    const response=await fetchJson("/api/news?team="+encodeURIComponent(team),14000);
    if(thisRun!==newsToken)return;
    newsCache[cacheKey(team)]={items:response.items||[],fetchedAt:response.fetchedAt};
   }catch(e){if(thisRun===newsToken)newsCache[cacheKey(team)]={error:"Haber servisine erişilemedi: "+String(e.message||e)}}
 }));
 if(thisRun!==newsToken)return;
 const count=targets.reduce((sum,team)=>sum+(newsCache[cacheKey(team)]?.items?.length||0),0);
 text($("news-status"),count?count+" kaynaklı başlık bulundu · Etkileri ayrıca onayla":"Haber kaynağından güncel başlık alınamadı veya servis geçici erişilemiyor.");
 renderNews();
}
function currentContext(team){
 const c=makeContext(team);
 const morale=.018*(Number(c.morale)||0),pressure=.014*(Number(c.pressure)||0),fatigue=.023*(Number(c.fatigue)||0);
 return {factor:clamp(morale+pressure+fatigue,-.17,.17),morale,pressure,fatigue};
}
function weightedStats(dataset,team,mode){
 const records=dataset.filter(m=>m.home===team||m.away===team).slice(0,48);
 let scored=0,conceded=0,weight=0,used=0;
 records.forEach((m,i)=>{
  const atHome=m.home===team;
  if(mode==="home"&&!atHome||mode==="away"&&atHome)return;
  const w=Math.exp(-i/21);
  scored+=(atHome?m.hg:m.ag)*w;conceded+=(atHome?m.ag:m.hg)*w;weight+=w;used++;
 });
 return {gf:weight?scored/weight:null,ga:weight?conceded/weight:null,n:used};
}
function modelRates(home,away){
 const past=playedBefore(chosen?.date),h=weightedStats(past,home,"all"),a=weightedStats(past,away,"all");
 if(h.n<5||a.n<5)throw Error("İki takımın da en az 5 geçmiş tamamlanmış maç kaydı bulunmalı.");
 const vh=weightedStats(past,home,"home"),va=weightedStats(past,away,"away");
 const blend=(overall,venue,key,fallback)=>venue.n>=3?.65*venue[key]+.35*(overall[key]??fallback):overall[key]??fallback;
 const baseHome=clamp(.58*blend(h,vh,"gf",1.5)+.42*blend(a,va,"ga",1.5),.3,3.6);
 const baseAway=clamp(.58*blend(a,va,"gf",1.2)+.42*blend(h,vh,"ga",1.2),.3,3.4);
 const hc=currentContext(home),ac=currentContext(away),hl=lineupEffect(home),al=lineupEffect(away),hn=newsEffect(home),an=newsEffect(away);
 const homeFactor=clamp(1+hc.factor+hl.attack-al.defense*.65+hn.effect,.74,1.26);
 const awayFactor=clamp(1+ac.factor+al.attack-hl.defense*.65+an.effect,.74,1.26);
 const latest=past[0]?.date||"",age=latest?days(latest,dateToday()):999,issue=age>14?"Kaynak sonuçları "+age+" gündür güncel görünmüyor. ":"";
 const warnings=[issue,
  hl.filled<11||al.filled<11?"Kadro bilgilerinin bir bölümü eksik / varsayımsal. ":"",
  hn.count||an.count?"Onaylı haber etkileri başlık yorumuna dayanır; doğrulanmış oyuncu haberi değildir. ":"",
  "Model geçmiş skorlarla kalibre edilmiş profesyonel tahmin sistemi değildir."].filter(Boolean);
 return {home:clamp(baseHome*homeFactor,.15,4.2),away:clamp(baseAway*awayFactor,.15,4.2),baseHome,baseAway,homeFactor,awayFactor,hl,al,hc,ac,hn,an,usedHome:h.n,usedAway:a.n,warnings};
}
function samplePoisson(lambda){let sum=0,k=0,p=1,limit=Math.exp(-lambda);do{p*=Math.random();k++}while(p>limit&&k<16);return k-1}
function detailsRow(parent,label,value){const line=node("div","mini-line");line.append(node("span",null,label),node("b",null,value));parent.append(line)}
function simulationReset(){
 runToken++;
 for(const id of ["win-home","win-draw","win-away"])text($(id),"—");
 for(const id of ["bar-home","bar-draw","bar-away"])$(id).style.width="0%";
 $("sim-progress").style.width="0%";
 text($("sim-n"),"0 / 1.000 SİMÜLASYON");text($("sim-score"),"— : —");text($("sim-status"),"Başlamaya hazır");
 $("score-modes").replaceChildren(node("p","placeholder","Simülasyon bekleniyor."));
 $("scenarios").replaceChildren(node("p","placeholder","Simülasyon bekleniyor."));
 text($("impact-box"),"Model girdileri hesaplanmayı bekliyor.");
}
function simulate(){
 const {home,away}=currentPair();
 if(!home||!away||home===away){notify("İki farklı takım seçin.",true);return}
 let model;try{model=modelRates(home,away)}catch(e){notify("Simülasyon başlatılamadı: "+String(e.message||e),true);return}
 simulationReset();const myToken=runToken;
 const trials=Array.from({length:1000},()=>{
  const pace=clamp(.85+Math.random()*.30,.75,1.25);
  return [samplePoisson(model.home*pace),samplePoisson(model.away*pace)];
 });
 const counts={h:0,d:0,a:0,over15:0,over25:0,over35:0,btts:0,under25:0,cleanH:0,cleanA:0,scores:{},homeGoals:0,awayGoals:0};
 let n=0;
 const draw=()=>{
  const total=n,prop=x=>x/total;
  text($("sim-n"),n.toLocaleString("tr-TR")+" / 1.000 SİMÜLASYON");
  $("sim-progress").style.width=n/10+"%";
  text($("win-home"),pct(prop(counts.h)));text($("win-draw"),pct(prop(counts.d)));text($("win-away"),pct(prop(counts.a)));
  $("bar-home").style.width=pct(prop(counts.h));$("bar-draw").style.width=pct(prop(counts.d));$("bar-away").style.width=pct(prop(counts.a));
  const scoreBox=$("score-modes"),scen=$("scenarios");scoreBox.replaceChildren();scen.replaceChildren();
  for(const [k,v] of Object.entries(counts.scores).sort((a,b)=>b[1]-a[1]).slice(0,5))detailsRow(scoreBox,k,v+" kez · "+pct(prop(v)));
  for(const [k,v] of [["2,5 Üst",counts.over25],["2,5 Alt",counts.under25],["KG Var",counts.btts],["3,5 Üst",counts.over35],["Ev gol yemeden",counts.cleanH],["Dep gol yemeden",counts.cleanA]])detailsRow(scen,k,pct(prop(v)));
  if(total===1000)text($("sim-status"),"1.000 koşu tamamlandı");
  const se=Math.sqrt(Math.max(0,prop(counts.h)*(1-prop(counts.h))/n));
  text($("impact-box"),"Beklenen gol "+model.home.toFixed(2)+" : "+model.away.toFixed(2)+" (xG değil) • Ev değişimi "+signed(model.homeFactor-1)+" · Dep değişimi "+signed(model.awayFactor-1)+
   " • Sonuçların Monte Carlo örnekleme payı (ev galibiyeti yaklaşık ±"+(196*se).toFixed(1)+" yüzde puan) • "+
   model.warnings.join(" "));
 };
 function tick(){
  if(myToken!==runToken)return;
  const step=speed===1?1:speed===10?10:100;
  for(let j=0;j<step&&n<1000;j++){
   const [h,a]=trials[n++],key=h+" - "+a;counts.scores[key]=(counts.scores[key]||0)+1;
   if(h>a)counts.h++;else if(h===a)counts.d++;else counts.a++;
   if(h+a>1)counts.over15++;if(h+a>2)counts.over25++;else counts.under25++;
   if(h+a>3)counts.over35++;
   if(h>0&&a>0)counts.btts++;if(a===0)counts.cleanH++;if(h===0)counts.cleanA++;
   counts.homeGoals+=h;counts.awayGoals+=a;
   text($("sim-score"),h+" : "+a);
  }
  $("ball").style.left=(12+Math.random()*75)+"%";$("ball").style.top=(12+Math.random()*75)+"%";
  draw();
  if(n<1000)setTimeout(tick,speed===1?110:speed===10?75:70);
 }
 tick();
}
function dedupeEntries(rows){
 const map=new Map();
 for(const row of rows){
  if(!row||!isDate(row.date)||!row.home||!row.away||!Number.isInteger(row.hg)||!Number.isInteger(row.ag))continue;
  map.set([row.date,normalized(row.home),normalized(row.away)].join("|"),row);
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function dedupeFixture(rows){
 const m=new Map();
 for(const row of rows){
  if(!row||!isDate(row.date)||!row.home||!row.away)continue;
  m.set([row.date,normalized(row.home),normalized(row.away)].join("|"),row);
 }
 return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function parseOpenfootball(json,season){
 if(!Array.isArray(json.matches))throw Error("Beklenmeyen dosya formatı");
 const complete=[],future=[];
 for(const m of json.matches){
  const home=String(m.team1||"").trim(),away=String(m.team2||"").trim(),date=String(m.date||"").slice(0,10);
  if(!home||!away||!isDate(date))continue;
  const ft=Array.isArray(m.score)?m.score:m.score?.ft;
  if(date<=dateToday()&&Array.isArray(ft)&&ft.length>=2&&ft.slice(0,2).every(n=>Number.isInteger(n)&&n>=0&&n<30))complete.push({home,away,date,hg:ft[0],ag:ft[1],season,source:"OpenFootball"});
  else if(date>=dateToday())future.push({home,away,date,time:m.time||"",season,source:"OpenFootball"});
 }
 return {complete,future};
}
async function openFootballFile(l,season){
 const path=season+"/"+l.short+".1.json",urls=["https://raw.githubusercontent.com/openfootball/football.json/master/","https://cdn.jsdelivr.net/gh/openfootball/football.json@master/"];
 for(let i=0;i<urls.length;i++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
  try{
   const response=await fetch(urls[i]+path,{signal:controller.signal});
   if(response.status===404)return null;
   if(!response.ok)throw Error("HTTP "+response.status);
   return await response.json();
  }catch(e){if(i===urls.length-1)throw e}finally{clearTimeout(timer)}
 }
 return null;
}
function refreshCurrent(){renderLeagues();const h=$("team-home").value,a=$("team-away").value;makeOpts($("team-home"),teams(),h);makeOpts($("team-away"),teams(),a);syncBanner();renderFixtures();updateSelectedUI()}
async function syncOpenFootball(ids){
 if(syncing)return;syncing=true;
 const buttons=[$("sync-current"),$("sync-all"),$("sync-live")];buttons.forEach(b=>b.disabled=true);
 const status=$("sync-message");text(status,"Kaynak bağlantısı kuruluyor...");
 const outcomes=await Promise.all(ids.map(async id=>{
  const l=LEAGUES.find(x=>x.id===id);let games=[],next=[],seasons=[],failed=[];
  for(const season of SEASONS){
   try{const json=await openFootballFile(l,season);if(!json){failed.push(season+" yok");continue}
    const parsed=parseOpenfootball(json,season);games.push(...parsed.complete);next.push(...parsed.future);seasons.push(season);
   }catch(e){failed.push(season+": "+String(e.message||e))}
  }
  if(!games.length)return {id,ok:false,reason:failed.join("; ").slice(0,170)};
  matches[id]=dedupeEntries([...(Array.isArray(matches[id])?matches[id]:[]),...games]);
  fixtures[id]=dedupeFixture([...(Array.isArray(fixtures[id])?fixtures[id]:[]),...next]).filter(x=>x.date>=dateToday());
  const latest=matches[id].map(x=>x.date).sort().at(-1);
  metadata[id]={source:"OpenFootball CC0",updatedAt:new Date().toISOString(),latestResult:latest,seasons,failed,fixtures:fixtures[id].length,count:matches[id].length};
  text(status,l.name+" tamamlandı · "+matches[id].length+" maç");
  return {id,ok:true,count:matches[id].length,missing:failed.length};
 }));
 const ok=outcomes.filter(x=>x.ok).length;
 persist(LS.matches,matches);persist(LS.fixtures,fixtures);persist(LS.meta,metadata);refreshCurrent();
 text(status,ok+"/"+ids.length+" lig güncellendi. "+outcomes.map(x=>LEAGUES.find(l=>l.id===x.id).name+": "+(x.ok?x.count+" sonuç":"HATA "+x.reason)).join(" | "));
 buttons.forEach(b=>b.disabled=false);syncing=false;
}
async function syncApi(){
 if(syncing)return;syncing=true;
 const btns=[$("sync-current"),$("sync-all"),$("sync-live")];btns.forEach(b=>b.disabled=true);
 const status=$("sync-message");text(status,"Ücretsiz güncel API kontrol ediliyor...");
 let success=0,failed=[];
 for(const l of LEAGUES){
  try{
   const data=await fetchJson("/api/matches?league="+l.id,18000);
   let raw=Array.isArray(matches[l.id])?matches[l.id]:[];
   const canon=name=>canonical(name,l.id);
   const complete=data.completed.map(m=>({...m,home:canon(m.home),away:canon(m.away)}));
   const future=data.upcoming.map(m=>({...m,home:canon(m.home),away:canon(m.away)}));
   raw=dedupeEntries([...raw,...complete]);
   matches[l.id]=raw;
   fixtures[l.id]=dedupeFixture([...(fixtures[l.id]||[]),...future]).filter(x=>x.date>=dateToday());
   const latest=raw.map(x=>x.date).sort().at(-1);
   metadata[l.id]={source:"OpenFootball + football-data.org free",updatedAt:new Date().toISOString(),latestResult:latest,seasons:SEASONS,fixtures:fixtures[l.id].length,count:raw.length};
   success++;text(status,l.name+" ücretsiz API üzerinden güncellendi.");
  }catch(e){failed.push(l.name+": "+String(e.message||e))}
 }
 if(success){persist(LS.matches,matches);persist(LS.fixtures,fixtures);persist(LS.meta,metadata);refreshCurrent()}
 text(status,success+" lig güncellendi. "+(failed.length?"Kalan sorunlar: "+failed.join(" / "):"Veri akışı alındı."));
 btns.forEach(b=>b.disabled=false);syncing=false;
}
function csvRows(csv){
 csv=csv.replace(/^\uFEFF/,"");const output=[];let parts=[],value="",quote=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quote&&csv[i+1]==='"'){value+='"';i++}else quote=!quote}
  else if(c===","&&!quote){parts.push(value);value=""}
  else if((c==="\n"||c==="\r")&&!quote){if(c==="\r"&&csv[i+1]==="\n")i++;parts.push(value);if(parts.some(Boolean))output.push(parts);parts=[];value=""}
  else value+=c;
 }
 parts.push(value);if(parts.some(Boolean))output.push(parts);
 if(output.length<2)throw Error("CSV'de kayıt yok.");
 const columns=output.shift().map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,""));
 const ix=name=>columns.indexOf(name);
 const idx=["date","hometeam","awayteam","fthg","ftag"].map(ix);
 if(idx.some(i=>i<0))throw Error("CSV Date, HomeTeam, AwayTeam, FTHG, FTAG içermeli.");
 const games=[];
 for(const row of output){
  let [date,home,away,hg,ag]=idx.map(i=>String(row[i]||"").trim());
  if(/^\d{2}\/\d{2}\/\d{2,4}$/.test(date)){const [d,m,y]=date.split("/");date=(y.length===2?"20"+y:y)+"-"+m+"-"+d}
  if(!isDate(date)||!/^\d+$/.test(hg)||!/^\d+$/.test(ag)||!home||!away)continue;
  games.push({date,home,away,hg:Number(hg),ag:Number(ag),source:"CSV"});
 }
 if(!games.length)throw Error("Tamamlanmış geçerli maç yok.");
 return dedupeEntries(games);
}
async function importCsv(){
 const f=$("csv-file").files[0];if(!f){text($("sync-message"),"Önce CSV dosyası seç.");return}
 if(f.size>10*1024*1024){text($("sync-message"),"En fazla 10 MB destekleniyor.");return}
 try{
  const rows=csvRows(await f.text());
  matches[league]=dedupeEntries([...(matches[league]||[]),...rows]);
  metadata[league]={source:"OpenFootball / manuel CSV",updatedAt:new Date().toISOString(),latestResult:matches[league].map(x=>x.date).sort().at(-1),count:matches[league].length};
  persist(LS.matches,matches);persist(LS.meta,metadata);refreshCurrent();
  text($("sync-message"),rows.length+" CSV kaydı içe aktarıldı. Toplam "+matches[league].length+" maç.");
 }catch(e){text($("sync-message"),"İçe aktarım hatası: "+String(e.message||e))}
}
async function checkApi(){
 text($("api-status-text"),"Kontrol ediliyor...");
 try{
  const response=await fetchJson("/api/matches?league="+league,18000);
  text($("api-status-text"),"Ücretsiz API aktif. "+(response.completed?.length||0)+" tamamlanmış ve "+(response.upcoming?.length||0)+" planlanan maç kayıtlı. Servis skorları gecikmeli verebilir.");
 }catch(e){text($("api-status-text"),"Henüz aktif değil: "+String(e.message||e))}
}
function connectEvents(){
 for(const b of document.querySelectorAll("#tabs [data-tab]"))b.addEventListener("click",()=>setTab(b.dataset.tab));
 $("fixture-filters").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{fixtureFilter=b.dataset.fixture;document.querySelectorAll("#fixture-filters button").forEach(x=>x.classList.toggle("active",x===b));renderFixtures()}));
 $("fixture-search").addEventListener("input",renderFixtures);$("fixture-limit").addEventListener("change",renderFixtures);
 for(const id of ["team-home","team-away"])$(id).addEventListener("change",()=>{chosen=null;newsCache={};newsToken++;simulationReset();updateSelectedUI()});
 $("simulate").addEventListener("click",simulate);
 $("open-lineups").addEventListener("click",()=>setTab("lineup"));
 $("speeds").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{speed=Number(b.dataset.speed);$("speeds").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b))}));
 $("reset-factors").addEventListener("click",()=>{
  const {home,away}=currentPair();for(const team of [home,away]){if(team){contexts[pairKey(team)]={morale:0,pressure:0,fatigue:0};for(const k of Object.keys(approvals)){if(k.startsWith(cacheKey(team)+"|"))delete approvals[k]}}}
  persist(LS.context,contexts);persist(LS.approvals,approvals);renderPsych();renderNews();notify("Moral, baskı, hazır oluş senaryoları ve haber onayları sıfırlandı. İlk 11 kayıtları korundu.");
 });
 $("fetch-news").addEventListener("click",loadNews);
 const show=()=>{$("sync-modal").classList.add("show");$("sync-modal").setAttribute("aria-hidden","false")};
 const hide=()=>{$("sync-modal").classList.remove("show");$("sync-modal").setAttribute("aria-hidden","true")};
 $("open-sync").addEventListener("click",show);$("close-sync").addEventListener("click",hide);
 $("sync-modal").addEventListener("click",e=>{if(e.target===$("sync-modal"))hide()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
 $("sync-current").addEventListener("click",()=>syncOpenFootball([league]));
 $("sync-all").addEventListener("click",()=>syncOpenFootball(LEAGUES.map(l=>l.id)));
 $("sync-live").addEventListener("click",syncApi);
 $("import-csv").addEventListener("click",importCsv);
 $("api-status-check").addEventListener("click",checkApi);
}
function init(){
 connectEvents();setLeague("eng");setTab("match");simulationReset();
 if(LEAGUES.every(l=>!matches[l.id]?.length)){notify("İlk açılış: beş ligin ücretsiz maç arşivi indiriliyor.");syncOpenFootball(LEAGUES.map(l=>l.id))}
}
init();
})();