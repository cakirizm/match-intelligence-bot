/* SIMULAB V3 Scout: basic-source profiles, user CSV, on-device OCR with manual review */
(() => {
"use strict";
const KEY="simulab-v3-scout";
const $=id=>document.getElementById(id);
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");return x&&typeof x==="object"?x:{}}catch{return {}}};
let catalog=read(),shown={home:"",away:""},ocrLib=null;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(catalog));return true}catch{return false}};
const state=()=>window.SIMULAB_API?.getState()||{league:"eng",home:"",away:""};
const dbKey=(name,league)=>[league||state().league,name].join("|");
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const status=(side,msg)=>{const x=$("scout-status-"+side);if(x)x.textContent=msg};
const stat=n=>n===null||n===undefined||n===""||!Number.isFinite(Number(n))?"Veri yok":String(n);
const fPos={Goalkeeper:"Kaleci",Defender:"Defans",Defence:"Defans",Midfielder:"Orta saha",Midfield:"Orta saha",Attacker:"Forvet",Offence:"Forvet",Forward:"Forvet",GK:"Kaleci",DF:"Defans",MF:"Orta saha",FW:"Forvet"};
const pos=p=>fPos[p]||p||"Bilinmiyor";
function record(team){return catalog[dbKey(team)]||null}
function cleanPlayer(p,source){
 const numeric=k=>p[k]===undefined||p[k]===null||p[k]===""?null:(Number.isFinite(Number(p[k]))&&Number(p[k])>=0?Number(p[k]):null);
 return {id:Number.isInteger(p.id)?p.id:null,name:String(p.name||"").trim().slice(0,75),position:String(p.position||"").slice(0,35),nationality:String(p.nationality||"").slice(0,45),
 dateOfBirth:String(p.dateOfBirth||"").slice(0,10)||null,minutes:numeric("minutes"),appearances:numeric("appearances"),goals:numeric("goals"),assists:numeric("assists"),
 positions:p.positions&&typeof p.positions==="object"&&!Array.isArray(p.positions)?p.positions:null,source:source||p.source||"Bilinmiyor"};
}
function detail(side,p){
 const box=$("scout-detail-"+side);box.replaceChildren();
 box.append(node("strong",null,p.name),node("p",null,"Mevki: "+pos(p.position)+" · Uyruk: "+(p.nationality||"bilinmiyor")+" · Doğum: "+(p.dateOfBirth||"bilinmiyor")));
 box.append(node("p",null,"Maç: "+stat(p.appearances)+" · Dakika: "+stat(p.minutes)+" · Gol: "+stat(p.goals)+" · Asist: "+stat(p.assists)));
 const hist=Object.entries(p.positions||{}).filter(([,n])=>Number(n)>0).sort((a,b)=>b[1]-a[1]);
 const total=hist.reduce((acc,[,n])=>acc+Number(n),0);
 const positionText=total?hist.map(([k,n])=>pos(k)+" "+n+" maç (%"+Math.round(n/total*100)+")").join(" · ")+" (kullanıcı veri seti)":"Maç bazında mevki kullanım geçmişi: kaynak bulunamadı";
 box.append(node("p",null,positionText));
 box.append(node("p",null,"Kaynak: "+(p.source==="football-data.org"?"football-data.org · temel kayıt; ilk 11 değil":"Kullanıcı CSV · bağımsız doğrulanmadı")+"."));
}
function addToEleven(side,p){
 const team=state()[side];if(!team)return;
 const entry=window.SIMULAB_API.getLineup(team),names=entry.players.map(x=>x.name);
 if(names.some(x=>norm(x)===norm(p.name))){status(side,p.name+" zaten ilk 11'de.");return}
 let slot=names.findIndex(x=>!x);
 if(slot<0){const answer=prompt("İlk 11 dolu. "+p.name+" kaçıncı sıraya yazılsın? 1-11");const i=Number(answer);if(!Number.isInteger(i)||i<1||i>11)return;slot=i-1}
 names[slot]=p.name;
 window.SIMULAB_API.saveLineup(team,names);
 status(side,p.name+" "+(slot+1)+". sıraya eklendi. Mevkiyi yukarıdan doğrula.");
 window.SIMULAB_REPLAY?.rerender?.();
}
function renderRoster(side){
 const team=state()[side],box=$("scout-list-"+side);box.replaceChildren();
 const item=record(team),players=item?.players||[];
 if(!players.length){box.append(node("p","placeholder","Kaynak listesi boş. Kadroyu çekebilir veya scout CSV yükleyebilirsin."));return}
 for(const p of players){
  const line=node("div","scout-person"),name=node("strong",null,p.name),position=node("span",null,pos(p.position)),button=node("button",null,"İlk 11'e ekle");
  name.style.cursor="pointer";name.addEventListener("click",()=>detail(side,p));
  button.addEventListener("click",()=>addToEleven(side,p));
  line.append(name,position,button);box.append(line);
 }
}
function renderSide(side,force=false){
 const pair=state(),team=pair[side]||"",ident=dbKey(team,pair.league);
 if(!force&&shown[side]===ident)return;
 shown[side]=ident;
 $("scout-name-"+side).textContent=team||"Takım seçilmedi";
 const cat=record(team);
 status(side,cat?.players?.length?cat.players.length+" oyuncu · "+cat.source+" · "+new Date(cat.updatedAt).toLocaleDateString("tr-TR"):"Oyuncu verisi henüz yok. Ücretsiz API anahtarı veya CSV gerekir.");
 $("scout-detail-"+side).textContent="Bir oyuncu seç: gerçek pozisyon ve mevcut istatistikler burada.";
 $("scout-text-"+side).value="";
 renderRoster(side);
}
async function loadSquad(side){
 const pair=state(),team=pair[side];if(!team){status(side,"Önce takım seç.");return}
 const target=dbKey(team,pair.league);status(side,"football-data.org temel kadro aranıyor...");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
 try{
  const response=await fetch("/api/squad?league="+encodeURIComponent(pair.league)+"&team="+encodeURIComponent(team),{signal:controller.signal});
  const json=await response.json();if(!response.ok)throw Error(json.error||"HTTP "+response.status);
  if(dbKey(state()[side])!==target)return;
  if(!Array.isArray(json.players)||!json.players.length)throw Error(json.coverage||"Kadro verisi ücretsiz planda boş.");
  const list=json.players.map(p=>cleanPlayer(p,"football-data.org")).filter(p=>p.name);
  const merged=new Map(list.map(p=>[norm(p.name),p]));
  for(const p of record(team)?.players||[]){if(p.source==="Kullanıcı CSV")merged.set(norm(p.name),p)}
  catalog[target]={source:"Kaynak + kullanıcı",updatedAt:new Date().toISOString(),players:[...merged.values()]};
  persist();renderRoster(side);
  status(side,list.length+" kaynak oyuncusu geldi. Konumlar temel profildir, maçtaki mevkileri değildir.");
 }catch(e){status(side,"⚠ "+String(e.message||e)+" · Fotoğraftan veya CSV ile devam edebilirsin.")}
 finally{clearTimeout(timer)}
}
function parseCSV(s){
 const rows=[];let row=[],v="",q=false;s=s.replace(/^\uFEFF/,"");
 for(let i=0;i<s.length;i++){
  const ch=s[i];
  if(ch==='"'){if(q&&s[i+1]==='"'){v+='"';i++}else q=!q}
  else if(ch===","&&!q){row.push(v);v=""}
  else if((ch==="\n"||ch==="\r")&&!q){if(ch==="\r"&&s[i+1]==="\n")i++;row.push(v);if(row.some(Boolean))rows.push(row);v="";row=[]}
  else v+=ch;
 }
 row.push(v);if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error("CSV boş.");
 const head=rows.shift().map(x=>norm(x).replace(/ /g,""));
 const ix=name=>head.indexOf(name);if(ix("player")<0)throw Error("Player sütunu yok.");
 const value=(r,k)=>ix(k)<0?"":String(r[ix(k)]||"").trim();
 const players=[];
 for(const row of rows){
  const name=value(row,"player");if(!name||name.length>75)continue;
  const positions={};
  for(const part of value(row,"positions").split("|")){
   const [p,n]=part.split(":").map(x=>String(x||"").trim());
   if(p&&Number.isInteger(Number(n))&&Number(n)>0&&Number(n)<100)positions[p.toUpperCase()]=Number(n);
  }
  players.push(cleanPlayer({name,position:value(row,"position"),minutes:value(row,"minutes"),goals:value(row,"goals"),assists:value(row,"assists"),appearances:value(row,"appearances"),positions},"Kullanıcı CSV"));
 }
 if(!players.length)throw Error("Geçerli oyuncu yok.");
 return players;
}
async function importCSV(side,file){
 if(!file)return;
 if(file.size>4*1024*1024){status(side,"CSV en fazla 4 MB olabilir.");return}
 const pair=state(),team=pair[side],ident=dbKey(team,pair.league);
 try{
  const players=parseCSV(await file.text());
  if(dbKey(state()[side])!==ident)return;
  const merged=new Map((record(team)?.players||[]).map(p=>[norm(p.name),p]));
  players.forEach(p=>merged.set(norm(p.name),p));
  catalog[ident]={source:"Oyuncu listesi / kullanıcı CSV",updatedAt:new Date().toISOString(),players:[...merged.values()]};
  persist();renderRoster(side);status(side,players.length+" oyuncu CSV'den eklendi. İstatistikler kullanıcı tarafından sağlandı, otomatik doğrulanmadı.");
 }catch(e){status(side,"CSV hatası: "+String(e.message||e))}
}
function normalizeName(s){
 return String(s||"").trim().replace(/^[\s#•|\d.\-]{1,9}/,"").replace(/\s{2,}/g," ").trim();
}
function extractNames(source,roster){
 const bad=/\b(lineup|substitute|bench|formation|manager|coach|starting|players|possession|kickoff|league|minute|goalkeeper|arsenal|bayern|chelsea|manchester|barcelona|liverpool|team)\b/i;
 const names=[];
 for(let name of String(source||"").split(/\r?\n/).map(normalizeName)){
  if(name.length<3||name.length>70||bad.test(name)||!/[\p{L}]/u.test(name)||name.split(/\s+/).length>5)continue;
  name=name.replace(/\b(GK|CB|LB|RB|CM|CDM|CAM|ST|LW|RW|CF)\b/gi,"").trim();
  if(!name)continue;
  const label=norm(name),matches=roster.filter(p=>norm(p.name)===label||norm(p.name).split(" ").at(-1)===label||norm(p.name).endsWith(" "+label));
  if(matches.length===1)name=matches[0].name;
  if(!names.some(n=>norm(n)===norm(name)))names.push(name);
 }
 return names;
}
function getOCR(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(ocrLib)return ocrLib;
 ocrLib=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error("OCR yüklenemedi."));
  script.onerror=()=>reject(Error("Ücretsiz OCR servisi tarayıcıda yüklenemedi."));
  document.head.append(script);
 });
 return ocrLib;
}
async function readImage(side){
 const file=$("scout-photo-"+side).files[0],pair=state(),team=pair[side],ident=dbKey(team,pair.league);
 if(!file){status(side,"Önce bir kadro fotoğrafı seç.");return}
 if(!file.type.startsWith("image/")||file.size>8*1024*1024){status(side,"En fazla 8 MB görsel seç.");return}
 try{
  status(side,"Ücretsiz OCR motoru indiriliyor; görüntü cihazda işleniyor...");
  const tess=await getOCR();if(ident!==dbKey(state()[side]))return;
  status(side,"Görüntüdeki yazılar okunuyor. Okuma hatalarını düzeltmen gerekecek.");
  const data=await tess.recognize(file,"eng");
  const raw=data.data?.text||"";
  const found=extractNames(raw,record(team)?.players||[]);
  $("scout-text-"+side).value=found.length?found.join("\n"):raw;
  status(side,found.length+" olası oyuncu satırı bulundu. Fotoğraftan okunan sıra mevkiyi garanti etmez. Kontrol edip kaydet.");
 }catch(e){status(side,"OCR kullanılamadı: "+String(e.message||e)+". Metni satır satır yapıştırabilirsin.")}
}
function apply(side){
 const team=state()[side];if(!team)return;
 const names=extractNames($("scout-text-"+side).value,record(team)?.players||[]);
 if(names.length!==11){status(side,"İlk 11 için tam 11 farklı isim gerek; şu an "+names.length+" satır var. Fotoğraftan okumayı düzelt.");return}
 if(!confirm(team+" ilk 11'ine 11 isim uygulanacak. OCR veya metin sırası yanlış olabilir. Onaylıyor musun?"))return;
 window.SIMULAB_API.saveLineup(team,names);
 status(side,"✓ 11 isim kaydedildi. Formasyon, mevki ve hazır oluşu yukarıdaki formda kontrol et.");
 window.SIMULAB_REPLAY?.rerender?.();
}
function copyCurrent(side){
 const team=state()[side];if(!team)return;
 $("scout-text-"+side).value=window.SIMULAB_API.getLineup(team).players.map(p=>p.name).filter(Boolean).join("\n");
 status(side,"Mevcut ilk 11 metin kutusuna aktarıldı.");
}
function refresh(){
 const s=state();
 for(const side of ["home","away"])if(shown[side]!==dbKey(s[side],s.league))renderSide(side);
}
function setup(){
 if(!$("scout-suite")||!window.SIMULAB_API)return;
 for(const side of ["home","away"]){
  $("load-scout-"+side).addEventListener("click",()=>loadSquad(side));
  $("scout-csv-"+side).addEventListener("change",e=>importCSV(side,e.target.files[0]));
  $("scout-ocr-"+side).addEventListener("click",()=>readImage(side));
  $("scout-apply-"+side).addEventListener("click",()=>apply(side));
  $("scout-copy-"+side).addEventListener("click",()=>copyCurrent(side));
  renderSide(side,true);
 }
 document.addEventListener("click",e=>{
  if(e.target.closest?.(".league")||e.target.closest?.(".fixture-item")||e.target.closest?.("#tabs [data-tab]"))setTimeout(refresh,40);
 });
 document.addEventListener("change",e=>{if(["team-home","team-away"].includes(e.target?.id))setTimeout(refresh,20)});
}
window.SIMULAB_SCOUT={get:team=>record(team),getPlayer:(team,name)=>(record(team)?.players||[]).find(p=>norm(p.name)===norm(name))||null,refresh};
setup();
})();