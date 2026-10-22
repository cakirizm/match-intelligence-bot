/* SIMULAB V5 TEAM STATION
 Public open roster = possible squad, NOT confirmed match XI.
 Never fabricate player data, appearances, positions by match or injuries. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const API=()=>window.SIMULAB_API;
const CACHE="simulab-v5-team-profiles";
const STATUS="simulab-v5-player-status";
const SCOUT="simulab-v3-scout";
const POS={"GK":"Kaleci","DF":"Defans","MF":"Orta saha","FW":"Forvet"};
const SHAPES={
 "4-3-3":["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"],
 "4-2-3-1":["GK","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW"],
 "4-4-2":["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"],
 "3-5-2":["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"]
};
const LEAGUES={eng:"Premier League",esp:"La Liga",ger:"Bundesliga",ita:"Serie A",fra:"Ligue 1",ucl:"Şampiyonlar Ligi"};
const own=(k)=>{try{const d=JSON.parse(localStorage.getItem(k)||"{}");return d&&typeof d==="object"&&!Array.isArray(d)?d:{}}catch{return {}}};
let cache=own(CACHE),statusMap=own(STATUS),selected=null,activePlayer=null,positionFilter="all",profileSeq=0,newsSeq=0,autoRunTimer=null,lastSimulation=null,recommended=[],forceOnMatch=false;
const save=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true}catch{return false}};
const node=(tag,cls,str)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(str!==undefined)e.textContent=String(str);return e};
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\b(fc|cf|afc|sc|club|football|futbol|de|the|a|ac|as|calcio|1907)\b/g," ").replace(/\s+/g," ").trim();
const pairKey=(name,league)=>[league||API()?.getState().league||"",name].join("|");
const sameTeam=(a,b)=>norm(a)===norm(b)&&!!norm(a);
const datestr=date=>date&&/^\d{4}-\d\d-\d\d$/.test(String(date))?date.slice(8,10)+"."+date.slice(5,7)+"."+date.slice(0,4):"—";
const msDate=()=>Date.now();
const readable=(s,max=90)=>String(s||"").slice(0,max);
const btn=(caption,handler,cls)=>{const b=node("button",cls||"btn outline",caption);b.type="button";b.addEventListener("click",handler);return b};
function trusted(url,domains){
 try{const u=new URL(url);return u.protocol==="https:"&&domains.includes(u.hostname)?u.href:null}catch{return null}
}
async function jsonGET(url,limit=16000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limit);
 try{
  const response=await fetch(url,{signal:controller.signal});
  const data=await response.json().catch(()=>({error:"Beklenmedik yanıt"}));
  if(!response.ok)throw Error(data.error||"HTTP "+response.status);
  return data;
 }finally{clearTimeout(timer)}
}
function listOfTeams(){
 const raw=API()?.getAllTeams()||[],out=new Map();
 for(const row of raw){
  if(!row.name||!LEAGUES[row.league])continue;
  const key=row.league+"|"+norm(row.name);
  if(!out.has(key))out.set(key,row);
 }
 return [...out.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr"));
}
function renderDirectory(){
 const box=$("team-directory");if(!box)return;
 box.replaceChildren();
 const group=$("team-directory-league").value,q=norm($("team-directory-search").value);
 const all=listOfTeams(),rows=all.filter(x=>(group==="all"||x.league===group)&&(!q||norm(x.name).includes(q)));
 $("team-directory-count").textContent=rows.length+" takım";
 if(!rows.length){box.append(node("p","placeholder","Veri henüz gelmedi. Ana sayfadan ücretsiz fikstür güncelle."));return}
 for(const t of rows.slice(0,220)){
  const b=node("button",selected?.league===t.league&&sameTeam(selected.name,t.name)?"selected":"");
  b.type="button";b.append(node("span",null,t.name),node("small",null,t.league==="ucl"?"🏆":t.league.toUpperCase()));
  b.addEventListener("click",()=>selectTeam(t.name,t.league));box.append(b);
 }
}
function currentProfile(){return selected?cache[pairKey(selected.name,selected.league)]||null:null}
function dataFresh(entry){return !!entry?.updatedAt&&Date.now()-Date.parse(entry.updatedAt)<8*3600*1000}
function getStatus(team,league,name){
 const row=statusMap[pairKey(team,league)]||{};
 return row[norm(name)]||"fit";
}
function setStatus(team,league,name,value){
 const k=pairKey(team,league),row=statusMap[k]||{};
 if(value==="fit")delete row[norm(name)];
 else row[norm(name)]=value;
 statusMap[k]=row;save(STATUS,statusMap);
}
function saveScout(data,team,league){
 if(!Array.isArray(data?.players)||!data.players.length)return;
 const existing=own(SCOUT),id=pairKey(team,league),old=existing[id]?.players||[];
 const map=new Map();
 for(const p of data.players){
  const prev=old.find(x=>norm(x.name)===norm(p.name));
  map.set(norm(p.name),{...p,position:p.position||prev?.position||"",source:p.source||"Wikipedia (community-edited)",
   minutes:prev?.minutes??null,goals:prev?.goals??null,assists:prev?.assists??null,
   appearances:prev?.appearances??null,positions:prev?.positions??null,fitness:prev?.fitness??null});
 }
 // Keep user-scoped CSV profiles, even if absent from Wikipedia's squad.
 for(const p of old){if(p.source==="Kullanıcı CSV"||p.source==="CSV")map.set(norm(p.name),p)}
 existing[id]={team,source:data.source,updatedAt:data.updatedAt,players:[...map.values()]};
 save(SCOUT,existing);
 window.SIMULAB_SCOUT?.refresh?.();
}
function points(t,league){
 const rows=API().getTeamMatches(t,league).filter(m=>m.isResult&&Number.isInteger(m.hg)&&Number.isInteger(m.ag)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
 let w=0,d=0,l=0,gf=0,ga=0;
 const seq=[];
 for(const m of rows){
  const h=sameTeam(m.home,t),f=h?m.hg:m.ag,a=h?m.ag:m.hg;gf+=f;ga+=a;
  if(f>a){w++;seq.push("G")}else if(f===a){d++;seq.push("B")}else{l++;seq.push("M")}
 }
 return {rows,w,d,l,gf,ga,seq};
}
function renderTop(){
 if(!selected)return;
 const item=currentProfile(),club=item?.profile||null;
 $("team-profile-name").textContent=selected.name;
 $("team-profile-league").textContent=LEAGUES[selected.league]+" • "+(item?.source||"AÇIK VERİ KONTROLÜ");
 $("team-profile-details").textContent=club?[club.stadium,club.location,club.formed?"Kuruluş "+club.formed:""].filter(Boolean).join(" · "):"Açık futbol veri kaynaklarından takım bilgisi deneniyor.";
 const symbol=$("team-profile-icon");symbol.replaceChildren();
 const badge=trusted(club?.badge,["r2.thesportsdb.com","www.thesportsdb.com","thesportsdb.com","upload.wikimedia.org"]);
 if(badge){const im=node("img");im.src=badge;im.alt=selected.name+" arması";im.loading="lazy";symbol.append(im)}else symbol.append(node("span",null,"⚽"));
 const latest=item?.updatedAt?new Date(item.updatedAt).toLocaleString("tr-TR"):"henüz yüklenmedi";
 $("team-profile-source").textContent="Oyuncu kaynağı: "+(item?.source||"kontrol ediliyor")+" · Son kontrol: "+latest+
  ". Bu liste tescilli veya maç günü onaylanmış ilk 11 değildir.";
 const stat=points(selected.name,selected.league),kpis=$("team-profile-kpis");kpis.replaceChildren();
 const facts=[["Son 10 maç",stat.rows.length],["Galibiyet",stat.w],["Gol / Yenen",stat.gf+" / "+stat.ga],["Kadro kaydı",item?.players?.length||0]];
 for(const [label,value] of facts){const b=node("div","team-kpi");b.append(node("b",null,value),node("span",null,label));kpis.append(b)}
}
function renderGames(){
 if(!selected)return;
 const entries=API().getTeamMatches(selected.name,selected.league);
 const past=entries.filter(x=>x.isResult&&Number.isInteger(x.hg)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
 const future=entries.filter(x=>!x.isResult&&x.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
 const box=$("team-profile-matches"),line=$("team-formline");box.replaceChildren();line.replaceChildren();
 const summary=points(selected.name,selected.league);
 for(const outcome of summary.seq){line.append(node("b",outcome==="G"?"win":outcome==="B"?"draw":"loss",outcome))}
 for(const [list,heading] of [[future,"YAKLAŞAN MAÇLAR"],[past,"SON SONUÇLAR"]]){
  box.append(node("div","fixture-day",heading));
  if(!list.length){box.append(node("p","placeholder","Bu grupta kayıt yok."));continue}
  for(const m of list){
   const b=node("button","team-game"),op=sameTeam(m.home,selected.name)?m.away:m.home;
   b.append(node("small",null,datestr(m.date)),node("strong",null,op),node("span","score",m.isResult?m.hg+" - "+m.ag:"SİMÜLE ↗"));
   b.addEventListener("click",()=>{API().selectFixture(m,selected.league);$("page-match").scrollIntoView({behavior:"smooth",block:"start"})});
   box.append(b);
  }
 }
}
function candidates(teamData,shape){
 const arr=(teamData?.players||[]).filter(p=>p.name&&!["out","suspended"].includes(getStatus(selected?.name||teamData.requestedTeam||"",selected?.league||teamData.league||"",p.name)));
 const used=new Set(),out=[];
 const normPos=x=>["GK","DF","MF","FW"].includes(x)?x:null;
 for(const pos of SHAPES[shape]||SHAPES["4-3-3"]){
  let i=arr.findIndex((p,j)=>!used.has(j)&&normPos(p.position)===pos);
  if(i<0)i=arr.findIndex((p,j)=>!used.has(j)&&!normPos(p.position));
  if(i<0){out.push(null);continue}
  used.add(i);out.push(arr[i]);
 }
 return out;
}
function reviewXI(shouldChange=true){
 const data=currentProfile(),shape=$("team-xi-formation").value,box=$("team-xi-roster");
 if(shouldChange)recommended=candidates(data,shape);
 box.replaceChildren();
 const roles=SHAPES[shape]||SHAPES["4-3-3"];
 let missing=0;
 for(let i=0;i<11;i++){
  const p=recommended[i],status=p?getStatus(selected.name,selected.league,p.name):"";
  if(!p)missing++;
  const row=node("div","team-xi-row"+(status==="out"||status==="suspended"?" absent":""));
  row.append(node("small",null,String(i+1).padStart(2,"0")),node("span","pos",roles[i]),node("strong",null,
   p?p.name+(status==="out"?" · MANUEL YOK":status==="suspended"?" · MANUEL CEZA":status==="doubt"?" · MANUEL ŞÜPHELİ":""):"— uygun oyuncu yok"));
  box.append(row);
 }
 const matchStatus=missing?"Eksik "+missing+" mevki; hiçbir futbolcu uydurulmadı. ":"11 pozisyona kaynaklı isim yerleştirildi. ";
 const coverage=data?.rosterCoverage||"Kaynak yetersiz";
 $("team-xi-provenance").textContent=matchStatus+"Bu 11 sadece kaynaklı kayıtların genel mevki dağılımına göre oluşturulmuş bir TASLAKTIR. Form, sakatlık, rotasyon ve teknik direktör tercihi doğrulanmamıştır. "+coverage+".";
 $("team-xi-label").textContent=missing?missing+" kadro boşluğu":"Muhtemel / onaysız";
}
function applyXI(auto=false){
 if(!selected||!recommended?.length)return false;
 if(recommended.some(p=>!p)){if(!auto)alert("11 pozisyonu tamamlayamadım. Eksik oyuncuları Scout & İlk 11 bölümünde elle ekleyebilirsin.");return false}
 const team=selected.name;
 if(!API().setMatchSide)return false;
 const okSide=API().setMatchSide("home",team,selected.league);
 if(!okSide){if(!auto)alert("Bu takım ilgili turnuvanın fikstüründe bulunamadı.");return false}
 const match=API().getState();
 if(!auto&&!confirm("Bu, doğrulanmış maç ilk 11'i değildir. "+team+" için mevki temelli taslağı simülasyon kadrosu olarak kullanmak istiyor musun?"))return false;
 const names=recommended.map(p=>p.name);
 const result=API().saveLineup(team,names,$("team-xi-formation").value);
 if(result&&match.home&&match.away&&(sameTeam(match.home,team)||sameTeam(match.away,team))){
  API().refreshLineups();
  scheduleSimulation(350);
 }
 $("team-xi-provenance").textContent=(result?"Taslak simülasyon kadrosuna uygulandı. ":"Kaydedilemedi. ")+"Resmî ilk 11 doğrulanmadı; puanlar ve hazır oluş manuel varsayımlardır.";
 return result;
}
function renderRoster(){
 if(!selected)return;
 const data=currentProfile(),list=data?.players||[],box=$("team-profile-roster");box.replaceChildren();
 const q=norm($("team-roster-search").value);
 const rows=list.filter(p=>(positionFilter==="all"||p.position===positionFilter)&&(!q||norm(p.name).includes(q)||String(p.position).toLowerCase().includes(q)));
 $("team-roster-count").textContent=list.length+" kayıt";
 const errors=(data?.sourceErrors||[]).join(" • ");
 $("team-roster-warning").textContent=data?
  (data.rosterCoverage||"Oyuncu kapsamı belirtilmedi.")+(errors?" · Eksik kaynak: "+errors:""):
  "Takımın kaynaklı kadrosu henüz alınmadı. Gerçek oyuncu bilgisi uydurulmaz.";
 if(!rows.length){box.append(node("p","placeholder",list.length?"Filtreye uyan oyuncu yok.":"Ücretsiz kaynaktan kadro bulunamadı. Fotoğraftan/manual Scout girişi kullanılabilir."));return}
 for(const p of rows){
  const b=node("button","team-player-card"+(activePlayer&&norm(activePlayer.name)===norm(p.name)?" selected":""));
  const st=getStatus(selected.name,selected.league,p.name);
  b.type="button";
  const shirt=node("span","shirt",p.number||"·"),identity=node("span");
  identity.append(node("strong",null,p.name),node("small",null,(POS[p.position]||"Mevki yok")+" · "+(p.nationality||p.source)));
  const right=node("span","status-pill "+st,st==="out"?"YOK":st==="suspended"?"CEZA":st==="doubt"?"ŞÜPHELİ":"PROFİL ↗");
  b.append(shirt,identity,right);b.addEventListener("click",()=>{activePlayer=p;renderRoster();showPlayer(p)});
  box.append(b);
 }
}
function detailRow(box,k,v){
 const line=node("div","team-field-row");line.append(node("span",null,k),node("b",null,v||"Kaynakta yok"));box.append(line);
}
async function showPlayer(p){
 if(!selected||!p)return;
 const selectedId=selected.league+"|"+selected.name+"|"+p.name;
 $("team-player-name").textContent=p.name;
 $("team-player-source").textContent=p.source||"Açık kaynak";
 const box=$("team-player-detail");box.replaceChildren();
 const identity=node("div","player-detail-identity");
 const url=trusted(p.image,["r2.thesportsdb.com","www.thesportsdb.com","upload.wikimedia.org"]);
 if(url){const img=node("img");img.src=url;img.loading="lazy";img.alt=p.name;identity.append(img)}
 const intro=node("div");intro.append(node("h3",null,p.name),node("small",null,(POS[p.position]||"Mevki belirtilmedi")+" • "+(p.nationality||"Uyruk belirtilmedi")));
 identity.append(intro);box.append(identity);
 detailRow(box,"Formadaki numara",p.number||"Bilinmiyor");
 detailRow(box,"Ana mevki",POS[p.position]||p.positionDetail||"Bilinmiyor");
 detailRow(box,"Sezonluk oynanan mevki sayıları","Ücretsiz kaynakta yok");
 detailRow(box,"Dakika / Gol / Asist",p.minutes===null||p.minutes===undefined?"Veri yok":(p.minutes+" dk / "+(p.goals??"—")+" / "+(p.assists??"—")));
 const label=node("label","team-small-label","MANUEL MAÇ DURUMU (KAYNAKLI TIBBİ BİLGİ DEĞİL)");
 const select=node("select","player-status-select");
 for(const [val,caption] of [["fit","Bilinmiyor / Normal senaryo"],["doubt","Şüpheli oynayacak (manuel)"],["out","Oynamayacak (manuel)"],["suspended","Cezalı (manuel)"]]){
  const opt=node("option",null,caption);opt.value=val;select.append(opt);
 }
 select.value=getStatus(selected.name,selected.league,p.name);
 const captured={...selected};
 select.addEventListener("change",()=>{
  setStatus(captured.name,captured.league,p.name,select.value);
  if(selected?.name===captured.name&&selected?.league===captured.league){renderRoster();reviewXI(false)}
  const match=API().getState();
  if(sameTeam(match.home,captured.name)||sameTeam(match.away,captured.name))scheduleSimulation(350);
 });
 box.append(label,select);
 const sourceURL=trusted(p.sourceUrl,["en.wikipedia.org","www.thesportsdb.com","thesportsdb.com"]);
 if(sourceURL){const a=node("a",null,"Orijinal oyuncu kaynağını aç ↗");a.href=sourceURL;a.target="_blank";a.rel="noopener noreferrer";box.append(a)}
 const details=node("div","team-help","Bu profil topluluk/sağlayıcı kaynağının temel oyuncu bilgisidir. Sezon bazında dakikalar, kesin mevkiler, maç ilk 11'i ve sakatlık raporu olmayabilir.");box.append(details);
 if(!p.id)return;
 const stamp=selectedId,extra=node("p","team-help","Ücretsiz oyuncu istatistikleri kontrol ediliyor...");box.append(extra);
 try{
  const data=await jsonGET("/api/player?id="+encodeURIComponent(p.id),12500);
  if(!selected||selected.league+"|"+selected.name+"|"+activePlayer?.name!==stamp)return;
  extra.textContent=data.statsAvailable?"TheSportsDB'nin bildirdiği sezon istatistikleri (kapsam eksik olabilir):":data.statsMessage;
  for(const item of (data.stats||[]).slice(0,4)){
   const line=node("p","team-help",(item.season||"Sezon bilinmiyor")+
   " · Maç: "+(item.appearances??"—")+" · Dakika: "+(item.minutes??"—")+
   " · Gol: "+(item.goals??"—")+" · Asist: "+(item.assists??"—"));box.append(line);
  }
 }catch{extra.textContent="Detaylı oyuncu sezon istatistiği ücretsiz kaynaktan alınamadı."}
}
function renderNewsBox(items,error){
 const box=$("team-profile-news");box.replaceChildren();
 if(error){box.append(node("p","placeholder","Haber akışına erişilemedi: "+error));return}
 if(!items?.length){box.append(node("p","placeholder","Bu takım için güncel haber başlığı bulunamadı."));return}
 for(const news of items.slice(0,6)){
  const article=node("article","team-news-card");
  const safe=trusted(news.url,["news.google.com","www.google.com"]);
  if(safe){const a=node("a",null,news.title);a.href=safe;a.rel="noopener noreferrer";a.target="_blank";article.append(a)}
  else article.append(node("strong",null,news.title));
  article.append(node("small",null,[news.source,news.published?new Date(news.published).toLocaleDateString("tr-TR"):null].filter(Boolean).join(" · ")));
  box.append(article);
 }
}
async function loadNews(){
 if(!selected)return;
 const now={...selected},request=++newsSeq;
 $("team-profile-news").replaceChildren(node("p","placeholder","Kaynaklı haber başlıkları aranıyor..."));
 try{
  const data=await jsonGET("/api/news?team="+encodeURIComponent(now.name),14000);
  if(request!==newsSeq||selected?.name!==now.name||selected?.league!==now.league)return;
  renderNewsBox(data.items||[]);
 }catch(e){if(request===newsSeq)renderNewsBox([],""+(e.message||e))}
}
function renderFull(){
 if(!selected)return;
 renderDirectory();renderTop();renderGames();renderRoster();reviewXI(true);renderChanges();
 if(activePlayer){const p=currentProfile()?.players?.find(x=>norm(x.name)===norm(activePlayer.name));if(p){activePlayer=p;showPlayer(p)}else activePlayer=null}
}
function scheduleSimulation(ms=400){
 clearTimeout(autoRunTimer);
 autoRunTimer=setTimeout(()=>{
  if(!API()?.getState()?.home||!API()?.getState()?.away)return;
  API().simulate();
 },ms);
}
function applyAutoDraftToEmptyXI(name,league,data){
 if(!data?.automaticXIAllowed||!Array.isArray(data.players)||data.players.length<11)return false;
 const pair=API().getState();
 if(pair.league!==league||(!sameTeam(pair.home,name)&&!sameTeam(pair.away,name)))return false;
 const currentXI=API().getLineup(name);
 if(currentXI.players.some(p=>p.name))return false;
 const shape=currentXI.formation||"4-3-3";
 const lineup=candidates(data,shape);
 if(lineup.length!==11||lineup.some(p=>!p))return false;
 const applied=API().saveLineup(name,lineup.map(p=>p.name),shape);
 if(applied)scheduleSimulation(650);
 return !!applied;
}
async function fetchTeam(name,league,opts={}){
 const key=pairKey(name,league),existing=cache[key];
 if(!opts.force&&dataFresh(existing)&&existing?.players?.length){if(opts.autoXI)applyAutoDraftToEmptyXI(name,league,existing);return existing}
 const requestTag=++profileSeq;
 if(selected?.name===name&&selected?.league===league)$("team-profile-source").textContent="Ücretsiz takım ve oyuncu kaynakları güncelleniyor...";
 try{
  const data=await jsonGET("/api/team?league="+encodeURIComponent(league)+"&team="+encodeURIComponent(name),20500);
  if(data&&typeof data==="object"){
   const oldList=Array.isArray(existing?.players)?existing.players:[];
   const freshList=Array.isArray(data.players)?data.players:[];
   let next=data;
   if(oldList.length>=11&&freshList.length<11){
     // A temporary provider outage or free-tier truncation must not erase a rich cached roster.
     next={...existing,updatedAt:data.updatedAt,profile:data.profile||existing.profile,
      sourceErrors:[...(data.sourceErrors||[]),"Yeni kaynak kısmi kayıt gönderdi; eski kaynaklı kadro korundu."],
      staleRoster:true};
   }else if(oldList.length>=11&&freshList.length>=11){
     const prev=new Set(oldList.map(p=>norm(p.name))),newer=new Set(freshList.map(p=>norm(p.name)));
     const added=freshList.filter(p=>!prev.has(norm(p.name))).map(p=>p.name).slice(0,20);
     const removed=oldList.filter(p=>!newer.has(norm(p.name))).map(p=>p.name).slice(0,20);
     next={...data,changes:{added,removed,checkedAt:data.updatedAt,
      warning:"Liste farkı kaynak değişikliğidir; transfer, sakatlık veya sözleşme durumu olarak doğrulanmadı."}};
   }else if(existing?.changes){
     next={...data,changes:existing.changes};
   }
   cache[key]=next;save(CACHE,cache);
   if(Array.isArray(next.players)&&next.players.length)saveScout(next,name,league);
   if(selected?.name===name&&selected?.league===league)renderFull();
   if(opts.autoXI)applyAutoDraftToEmptyXI(name,league,next);
  }
  return cache[key];
 }catch(e){
  if(selected?.name===name&&selected?.league===league){
   $("team-profile-source").textContent="Kaynaklara ulaşılamadı: "+(e.message||e)+". Önceki bilgiler korunur.";
  }
  return existing||null;
 }
}
function selectTeam(name,league){
 if(!name||!LEAGUES[league])return;
 selected={name,league};activePlayer=null;positionFilter="all";
 $("team-position-filters").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.pos==="all"));
 renderFull();loadNews();fetchTeam(name,league);
}
function detectCurrent(){
 const state=API().getState(),league=state.league;
 const desired=state.home||listOfTeams().find(t=>t.league===league)?.name;
 if(desired&&(!selected||selected.league!==league||!sameTeam(selected.name,desired)))selectTeam(desired,league);
 else renderDirectory();
}

function renderChanges(){
 const box=$("team-profile-alerts");if(!box||!selected)return;
 box.replaceChildren();
 const current=currentProfile(),changes=current?.changes;
 const panel=node("div","team-change-log");
 panel.append(node("strong",null,"Kadrodaki kaynak güncellemeleri"));
 if(!changes){panel.append(node("p",null,"İlk kayıttan sonraki güncellemede eklenen ve listeden çıkan isimler burada karşılaştırılır. Bu kayıt transfer veya sakatlık doğrulaması değildir."))}
 else{
  const label=changes.checkedAt?new Date(changes.checkedAt).toLocaleString("tr-TR"):"tarih bilinmiyor";
  panel.append(node("p",null,"Kaynak karşılaştırması: "+label));
  panel.append(node("p",null,"Yeni görülen isimler: "+(changes.added?.length?changes.added.join(", "):"yok")));
  panel.append(node("p",null,"Artık görünmeyen isimler: "+(changes.removed?.length?changes.removed.join(", "):"yok")));
  panel.append(node("p",null,changes.warning||"Bu yalnızca iki kaynak liste arasındaki farktır."));
 }
 if(current?.staleRoster)panel.append(node("p",null,"⚠ Son yeni kaynak eksik döndü; önceki kadro saklandı."));
 if(current?.rosterUrl){
  const link=trusted(current.rosterUrl,["en.wikipedia.org"]);
  if(link){const a=node("a",null,"Orijinal açık lisanslı kadro sayfası ↗");a.href=link;a.target="_blank";a.rel="noopener noreferrer";panel.append(a)}
 }
 box.append(panel);
}
let matchXIToken=0;
async function checkMatchXI(){
 const st=API().getState(),match=st.chosen,token=++matchXIToken;
 const label=$("match-source-xi");if(!label)return;
 if(!match?.date||!st.home||!st.away){label.textContent="Fikstürden maç seçildiğinde ücretsiz kadro kaynağı kontrol edilir.";return}
 label.textContent="Maç tarihi ve iki takımla ücretsiz kadro kaynağı eşleştiriliyor...";
 try{
  const url="/api/lineup?"+new URLSearchParams({home:st.home,away:st.away,date:match.date,id:String(match.eventId||"")}).toString();
  const data=await jsonGET(url,14000);
  if(token!==matchXIToken)return;
  const now=API().getState();
  if(now.home!==st.home||now.away!==st.away||now.chosen?.date!==st.chosen?.date)return;
  label.textContent=data.message||"Kaynak kadro sonucu bulunamadı.";
  if(!data.matchedEvent||!data.complete)return;
  // Source supplies 11 per team: only fill empty scenario XIs; never overwrite manually entered XIs.
  let applied=0;
  for(const [side,team] of [["home",st.home],["away",st.away]]){
   const ownXI=API().getLineup(team);
   if(ownXI.players.some(p=>p.name))continue;
   const names=data.players?.[side]?.map(p=>p.name).filter(Boolean)||[];
   if(names.length===11){API().saveLineup(team,names);applied++}
  }
  if(applied){
   label.textContent+=" "+applied+" boş simülasyon kadrosu kaynak oyuncularıyla tamamlandı. Bağımsız resmî kadro teyidi yapılmadı.";
   scheduleSimulation(400);
  }
 }catch(e){if(token===matchXIToken)label.textContent="Ücretsiz maç ilk 11'i kontrol edilemedi: "+(e.message||e)}
}

function onMatchSelected(match){
 if(!match)return;
 const current=API().getState();
 // Best effort: fetch both team profiles and auto-fill XI only if user XI is empty.
 fetchTeam(current.home,current.league,{autoXI:true});
 fetchTeam(current.away,current.league,{autoXI:true});
 checkMatchXI();
 if($("page-team").classList.contains("selected"))selectTeam(current.home,current.league);
}
function onTeamsChanged(){
 const state=API().getState();
 if(state.home&&state.away){
  fetchTeam(state.home,state.league,{autoXI:true});
  fetchTeam(state.away,state.league,{autoXI:true});
 }
}
function confidence(model){
 const recent=API().getState().results.map(m=>m.date).filter(Boolean).sort().at(-1),age=recent?
 Math.max(0,Math.floor((Date.now()-Date.parse(recent+"T00:00:00Z"))/86400000)):999;
 const count=Math.min(model.usedHome||0,model.usedAway||0);
 if(count>=15&&age<=10)return {grade:"ORTA",reason:"Yeterli takım skoru mevcut. Oyuncu ve kadro verisi yine sınırlı."};
 if(count>=6&&age<=21)return {grade:"DÜŞÜK–ORTA",reason:"Takım geçmişi kısmen mevcut."};
 return {grade:"DÜŞÜK",reason:"Eksik/eski sonuç, manuel kadro ve senaryo varsayımı."};
}
function afterSimulation(report){
 const box=$("v5-run-explain");if(!box||!report?.trials?.length)return;
 const {home,away,model,counts,runCount,trials}=report;box.replaceChildren();
 const conf=confidence(model);
 const scores=[...Object.entries(counts.scores)].sort((a,b)=>b[1]-a[1]);
 const most=scores[0],second=scores[1];
 const title=node("strong",null,"Birleşik maç raporu • "+home+" – "+away);
 box.append(title);
 const headline=node("div","v5-run-grid");
 for(const [value,label] of [
  [most?most[0]:"—","En sık skor"],
  [most?(100*most[1]/runCount).toFixed(1)+"%":"—","Bu skorun payı"],
  [model.home.toFixed(2)+" / "+model.away.toFixed(2),"Model gol ortalaması"]]){
  const p=node("div");p.append(node("b",null,value),node("span",null,label));headline.append(p);
 }
 box.append(headline);
 const info=node("ul","v5-insight-list");
 const facts=[
  "Ev takım geçmişi: "+model.usedHome+" maç; deplasman: "+model.usedAway+" maç. Model güveni: "+conf.grade+".",
  "İlk 11 girilmiş oyuncu: "+(model.hl?.filled||0)+"/11 – "+(model.al?.filled||0)+"/11; kaynak profili: "+((model.hl?.sourceProfiles||0)+(model.al?.sourceProfiles||0))+" oyuncu.",
  "Manuel moral/kadro/haber etkisi sonrası gol düzeltmesi: EV "+((model.homeFactor-1)*100).toFixed(1)+"%, DEP "+((model.awayFactor-1)*100).toFixed(1)+"%.",
  (model.hl?.absent||0)+(model.al?.absent||0)>0?"Oynamayacak/cezalı senaryosu işaretli oyuncu var; gerçek sakatlık doğrulaması değildir.":"Manuel 'oynamayacak' senaryosu kullanılmadı.",
  "Sonraki sık skor: "+(second?second[0]+" ("+(100*second[1]/runCount).toFixed(1)+"%)":"veri yok")+".",
  "Gol, şut ve asist animasyonu örnekleme ile üretilir. Gerçek saha hareketi veya resmî kadro bilgisi değildir."
 ];
 for(const phrase of facts)info.append(node("li",null,phrase));
 box.append(info,node("p","v5-status",conf.reason+" • Monte Carlo örneklemesi kendi içinde dalgalanır; bu yüzdeler bahis olasılığı olarak kalibre edilmemiştir."));
 if(lastSimulation&&lastSimulation.home===home&&lastSimulation.away===away&&
 lastSimulation.league===report.league&&lastSimulation.count===runCount){
  const p1=lastSimulation.h/runCount,p2=counts.h/runCount,delta=(p2-p1)*100;
  const diff=Math.abs(lastSimulation.xh-model.home)+Math.abs(lastSimulation.xa-model.away);
  box.append(node("p","team-help",diff>.015?
   "Önceki simülasyona göre ev kazanma payı "+(delta>=0?"+":"")+delta.toFixed(1)+" puan değişti. Model girdileri de değişti; bir kısmı rastgele örnekleme farkıdır.":
   "Önceki simülasyonla model girdileri aynı görünüyor; yüzdelerdeki küçük değişimler 5.000 farklı Monte Carlo örneğinin doğal oynaklığıdır."));
 }
 lastSimulation={home,away,league:report.league,count:runCount,h:counts.h,xh:model.home,xa:model.away};
}
function setup(){
 if(!$("team-directory")||!API())return;
 $("team-directory-league").addEventListener("change",renderDirectory);
 $("team-directory-search").addEventListener("input",renderDirectory);
 $("team-roster-search").addEventListener("input",renderRoster);
 $("team-position-filters").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  positionFilter=b.dataset.pos;$("team-position-filters").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));renderRoster();
 }));
 $("team-profile-refresh").addEventListener("click",()=>{if(selected)fetchTeam(selected.name,selected.league,{force:true})});
 $("team-xi-formation").addEventListener("change",()=>reviewXI(true));
 $("team-xi-create").addEventListener("click",()=>reviewXI(true));
 $("team-xi-apply").addEventListener("click",()=>applyXI(false));
 $("team-news-refresh").addEventListener("click",loadNews);
 $("match-xi-refresh")?.addEventListener("click",checkMatchXI);
 document.querySelector('[data-tab="team"]')?.addEventListener("click",()=>{detectCurrent()});
 document.addEventListener("click",e=>{
  if(e.target.closest?.(".league")||e.target.closest?.(".fixture-item")||e.target.closest?.("#global-fixtures")){
   setTimeout(()=>{renderDirectory();if($("page-team").classList.contains("selected"))detectCurrent()},80);
  }
 });
 onTeamsChanged();renderDirectory();
}
window.SIMULAB_V5={onMatchSelected,onTeamsChanged,afterSimulation,selectTeam,
 getTeam:(team,league)=>cache[pairKey(team,league)]||null,
 getStatus:(team,league,name)=>getStatus(team,league,name),
 refresh:()=>{renderDirectory();if(selected)renderFull()}};
setup();
})();