/* SIMULAB V6 visual analytics laboratory
 * Keeps all new data local to browser; no uploaded CSV is transmitted.
 */
(()=>{
"use strict";
const $=id=>document.getElementById(id),ENGINE=()=>window.SIMULAB_ENGINE_V6,API=()=>window.SIMULAB_API;
const TKEY="simulab-v6-tactics",XKEY="simulab-v6-xg";
const positionNames={GK:"Kaleci",DF:"Defans",MF:"Orta saha",FW:"Forvet"};
const FORMATIONS={"4-3-3":["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"],"4-2-3-1":["GK","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW"],"4-4-2":["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"],"3-5-2":["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"]};
const fmt=x=>Number(x).toLocaleString("tr-TR",{maximumFractionDigits:2}),percent=x=>(100*Number(x)).toFixed(1)+"%";
const node=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e};
const storageRead=(key,fallback)=>{try{const d=JSON.parse(localStorage.getItem(key)||"null");return d===null?fallback:d}catch{return fallback}};
const write=(key,obj)=>{try{localStorage.setItem(key,JSON.stringify(obj));return true}catch{return false}};
const allowed=new Set(["eng","esp","ger","ita","fra","ucl"]);
let tactics=storageRead(TKEY,{homePress:"normal",awayPress:"normal",homeStyle:"balanced",awayStyle:"balanced"});
if(!tactics||typeof tactics!=="object")tactics={homePress:"normal",awayPress:"normal",homeStyle:"balanced",awayStyle:"balanced"};
let xg=storageRead(XKEY,[]);if(!Array.isArray(xg))xg=[];
let lastResult=null,backtestResult=null,runningBacktest=false;
const useMatch=()=>API()?.getState()||{};
const getTactics=()=>({...tactics});
const getXgRows=()=>xg.slice(0,5000);
function renderProbabilityLine(root,name,base,next){
 const line=node("div","v6-prob-line");
 const label=node("span",null,name);
 const before=node("span","v6-prob-old",percent(base));
 const arrow=node("span",null,"→");
 const after=node("strong",null,percent(next));
 const delta=(100*(next-base)),sign=delta>0?"+":"";
 const diff=node("small",delta>.1?"v6-gain":delta<-.1?"v6-drop":"",""+sign+delta.toFixed(1)+" pp");
 line.append(label,before,arrow,after,diff);root.append(line);
}
function renderMain(model,distribution){
 const box=$("v6-model-summary");if(!box)return;
 box.replaceChildren();
 const title=node("div","v6-summary-title");
 title.append(node("strong",null,"V6 · ELO + DIXON–COLES"),node("span","v6-data-quality","Veri kapsamı: "+(model.v6?.quality||"SINIRLI")));
 box.append(title);
 const overview=node("div","v6-stat-grid");
 const m=model.v6,stats=[
  ["Ev gol ortalaması",fmt(model.home)],
  ["Dep gol ortalaması",fmt(model.away)],
  ["Elo farkı",m?(m.eloGap>0?"+":"")+Math.round(m.eloGap):"—"],
  ["Düşük skor ρ",model.rho?.toFixed(2)||"—"]
 ];
 for(const [label,value] of stats){const cell=node("div","v6-stat");cell.append(node("b",null,value),node("small",null,label));overview.append(cell)}
 box.append(overview);
 const p=node("p","v6-muted","Dixon–Coles skor olasılıkları: Ev "+percent(distribution.probs[0])+
 " · Beraberlik "+percent(distribution.probs[1])+" · Deplasman "+percent(distribution.probs[2])+". "+(m?.xgUsed?
 "Kullanıcının geçmiş xG verisi düşük ağırlıkla eklendi.":"Gerçek maç xG verisi bulunmadığından xG kullanılmadı."));
 box.append(p);
 const top=node("div","v6-top-scores");
 for(const game of distribution.top.slice(0,5)){const score=node("div","v6-score-pill");score.append(node("b",null,game.h+"–"+game.a),node("small",null,percent(game.p)));top.append(score)}
 box.append(top);
 const bottom=node("p","v6-muted","Yalnızca geçmiş gerçek skor kayıtları modele girdi. Elo + Dixon–Coles temel modelinin kapsama puanı doğruluk garantisi değildir; ligler arası maçlar takım gücünü sınırlı biçimde bağlar. Taktik/oyuncu/moral etkileri manuel senaryodur.");
 box.append(bottom);
}
function getSimulation(){
 const st=useMatch();if(!st.home||!st.away)return null;
 try{return API().getModel()}catch{return null}
}
function scenarioCandidates(){
 const st=useMatch(),side=$("v6-case-side")?.value||"home",team=st[side];
 const selection=$("v6-case-player");if(!selection)return;
 const old=selection.value;
 selection.replaceChildren();
 if(!team){const o=node("option",null,"Maç seç");o.value="";selection.append(o);return}
 const data=API().getLineup(team),shape=FORMATIONS[data.formation]||FORMATIONS["4-3-3"];
 let count=0;
 data.players.forEach((p,i)=>{
  if(!p.name)return;
  const item=node("option",null,p.name+" · "+(positionNames[shape[i]]||shape[i])+" · "+fmt(p.rating)+"/10");
  item.value=String(i);selection.append(item);count++;
 });
 if(!count){let item=node("option",null,"Oyuncu adları henüz girilmedi");item.value="";selection.append(item)}
 else if([...selection.options].some(o=>o.value===old))selection.value=old;
 else selection.value=selection.options[0].value;
}
function compare(){
 const box=$("v6-case-result");box.replaceChildren();
 const st=useMatch(),model=lastResult&&lastResult.home===st.home&&lastResult.away===st.away&&lastResult.league===st.league?lastResult.model:getSimulation();
 if(!model){box.append(node("p","placeholder","İki takım seçip simülasyonu çalıştır."));return}
 const side=$("v6-case-side").value,team=st[side],index=Number($("v6-case-player").value),xi=API().getLineup(team);
 if(!team||!Number.isInteger(index)||index<0||index>=xi.players.length||!xi.players[index].name){
  box.append(node("p","placeholder","İlk 11'de adlandırılmış bir oyuncu seç."));return;
 }
 const base=ENGINE().grid(model.home,model.away,model.rho),roles=FORMATIONS[xi.formation]||FORMATIONS["4-3-3"];
 const role=roles[index],p=xi.players[index],rating=Math.max(1,Math.min(10,Number(p.rating)||6.5));
 const star=Math.max(0,(rating-6)/4),impact=Math.min(.12,.045+.047*star);
 let lh=model.home,la=model.away;
 if(side==="home"){
  if(role==="GK")la*=1+impact;
  else if(role==="DF")la*=1+impact*.82;
  else if(role==="MF"){lh*=1-impact*.6;la*=1+impact*.35}
  else lh*=1-impact;
 }else{
  if(role==="GK")lh*=1+impact;
  else if(role==="DF")lh*=1+impact*.82;
  else if(role==="MF"){la*=1-impact*.6;lh*=1+impact*.35}
  else la*=1-impact;
 }
 const alternative=ENGINE().grid(lh,la,model.rho);
 box.append(node("strong",null,team+" · "+p.name+" olmadan"));
 box.append(node("p","v6-muted","Yerine aynı mevkide ortalama bir yedek geldiği varsayıldı. Oyuncunun gerçek yokluk etkisi değildir. "+role+" rolü / manuel puan: "+rating.toFixed(1)));
 for(const [label,i] of [["Ev kazanır",0],["Beraberlik",1],["Dep kazanır",2]])renderProbabilityLine(box,label,base.probs[i],alternative.probs[i]);
 box.append(node("p","v6-muted","Beklenen gol senaryosu: "+fmt(model.home)+"–"+fmt(model.away)+" → "+fmt(lh)+"–"+fmt(la)+
 ". Diğer bütün model girdileri sabit tutuldu; oyuncu yerine gelecek gerçek yedek doğrulanmadı."));
}
function renderBacktest(data,league){
 const box=$("v6-backtest-result");box.replaceChildren();
 if(data.error){box.append(node("p","placeholder",data.error+" ("+(data.available??data.tested??0)+" kayıt)."));return}
 const title=node("p","v6-muted",(league||"Seçili lig").toUpperCase()+" • "+
  data.tested+" ayrı maç • "+data.firstDate+" – "+data.lastDate+" • Sadece maç öncesi skorlar kullanıldı");
 box.append(title);
 const cards=node("div","v6-stat-grid");
 for(const [n,v] of [["Brier",fmt(data.brier)],["Referans Brier",fmt(data.baselineBrier)],["Log loss",fmt(data.logLoss)],["Doğru favori",percent(data.hitRate)]]){
  const stat=node("div","v6-stat");stat.append(node("b",null,v),node("small",null,n));cards.append(stat)
 }
 box.append(cards);
 const good=data.brier<data.baselineBrier;
 box.append(node("p",good?"v6-result-good":"v6-result-note",
  good?"Bu örneklemde modelin Brier skoru sabit referanstan daha düşük.":
  "Bu örneklemde model sabit referansın Brier skorunu geçemedi. Daha çok simülasyon çalıştırmak bunu düzeltmez."));
 const chart=node("div","v6-calibration");
 chart.append(node("h3",null,"Kalibrasyon: Söylenen oran / Gerçek gerçekleşme"));
 for(const bin of data.calibration||[]){
  const row=node("div","v6-calibration-row");
  const heading=node("div","v6-calibration-caption");
  heading.append(node("strong",null,bin.range+" ("+bin.n+" maç)"),node("small",null,percent(bin.p)+" tahmin / "+percent(bin.observed)+" gerçekleşme"));
  const track=node("div","v6-calibration-track");
  const predicted=node("span","v6-calibration-predicted");predicted.style.width=percent(bin.p);
  const observed=node("span","v6-calibration-actual");observed.style.width=percent(bin.observed);
  track.append(predicted,observed);row.append(heading,track);chart.append(row);
 }
 box.append(chart);
 box.append(node("p","v6-muted",data.methodology+" Sonuçlar yalnızca test edilen geçmiş lig maçlarıyla sınırlıdır; manual ilk 11 ve haber tahmin motoru ayrıca doğrulanmış değildir."));
}
function runBacktest(){
 if(runningBacktest)return;
 const st=useMatch(),league=st.league,engine=ENGINE();
 if(!league||!engine)return;
 runningBacktest=true;
 const button=$("v6-backtest");button.disabled=true;button.textContent="Hesaplanıyor...";
 $("v6-backtest-result").replaceChildren(node("p","placeholder","Tarih sıralı maçlar üzerinden eğitim ve test çalışıyor..."));
 setTimeout(()=>{
  try{
   const result=engine.backtest({leagueMatches:API().getLeagueMatches(league),allMatches:API().getAllHistoricalMatches(),
    xgRows:xg.filter(x=>x.league===league),maxGames:Number($("v6-test-samples").value)||130});
   backtestResult={league,result};renderBacktest(result,league);
  }catch(e){$("v6-backtest-result").replaceChildren(node("p","placeholder","Test tamamlanamadı: "+String(e.message||e)))}
  finally{runningBacktest=false;button.disabled=false;button.textContent="Geçmiş maçlarla test et"}
 },30);
}
function parseCSV(raw){
 const data=[],rows=[];let quote=false,cell="",line=[];
 for(let i=0;i<String(raw).length;i++){
  const c=raw[i];
  if(c==='"'){if(quote&&raw[i+1]==='"'){cell+='"';i++}else quote=!quote}
  else if(c===","&&!quote){line.push(cell);cell=""}
  else if((c==="\r"||c==="\n")&&!quote){if(c==="\r"&&raw[i+1]==="\n")i++;line.push(cell);if(line.some(x=>x.trim()))rows.push(line);line=[];cell=""}
  else cell+=c;
 }
 line.push(cell);if(line.some(x=>x.trim()))rows.push(line);
 if(rows.length<2)throw Error("CSV'de başlık ve veri satırı bulunmuyor.");
 const head=rows.shift().map(s=>s.replace(/^\uFEFF/,"").trim().toLowerCase());
 const col=name=>head.indexOf(name);
 for(const wanted of ["date","home","away","home_xg","away_xg"])if(col(wanted)<0)throw Error(wanted+" sütunu eksik.");
 let dropped=0;
 for(const row of rows){
  const val=name=>String(row[col(name)]??"").trim();
  const date=val("date"),home=val("home"),away=val("away"),hx=Number(val("home_xg")),ax=Number(val("away_xg"));
  const league=(col("league")>=0?val("league"):useMatch().league)||"";
  const source=(col("source")>=0?val("source"):"Kullanıcı CSV").slice(0,80);
  if(!allowed.has(league)||!/^\d{4}-\d\d-\d\d$/.test(date)||
   Number.isNaN(Date.parse(date))||date>new Date().toISOString().slice(0,10)||!home||!away||home===away||
   !val("home_xg")||!val("away_xg")||!Number.isFinite(hx)||!Number.isFinite(ax)||hx<0||ax<0||hx>9||ax>9){dropped++;continue}
  data.push({date,home:home.slice(0,90),away:away.slice(0,90),homeXg:hx,awayXg:ax,league,
   source:source||"Kullanıcı CSV · bağımsız doğrulama yok"});
 }
 return {data,dropped};
}
async function importXg(){
 const status=$("v6-xg-status"),file=$("v6-xg-file")?.files?.[0];
 if(!file){status.textContent="Önce bir CSV dosyası seç.";return}
 if(file.size>3*1024*1024){status.textContent="Dosya 3 MB sınırını aşıyor.";return}
 try{
  const raw=await file.text(),parsed=parseCSV(raw);
  if(!parsed.data.length){status.textContent="Uygun xG kaydı bulunamadı. Tarih, takım ve xG sütunlarını kontrol et.";return}
  const dict=new Map(xg.map(r=>[[r.league,r.date,ENGINE().key(r.home),ENGINE().key(r.away)].join("|"),r]));
  for(const item of parsed.data)dict.set([item.league,item.date,ENGINE().key(item.home),ENGINE().key(item.away)].join("|"),item);
  xg=[...dict.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4500);
  const okay=write(XKEY,xg);
  status.textContent=parsed.data.length+" kayıt okundu, "+parsed.dropped+" satır atlandı. Toplam "+xg.length+
   " kullanıcı kaydı. "+(okay?"Tarayıcıya kaydedildi.":"Tarayıcı depolamasına yazılamadı.")+
   " Bunlar otomatik doğrulanmadı; yalnızca ilgili takımların 4+ geçmiş kaydı varsa modele sınırlı ağırlıkla girer.";
 }catch(e){status.textContent="CSV okunamadı: "+String(e.message||e)}
}
function removeXg(){
 if(!xg.length){$("v6-xg-status").textContent="Yüklü xG verisi yok.";return}
 if(!confirm("Bu tarayıcıdaki kullanıcı xG arşivini silmek istiyor musun?"))return;
 xg=[];write(XKEY,xg);$("v6-xg-status").textContent="xG arşivi temizlendi. Sitedeki diğer maç ve kadro verilerine dokunulmadı.";
}
function renderTactics(){
 const map={"v6-home-press":"homePress","v6-away-press":"awayPress","v6-home-style":"homeStyle","v6-away-style":"awayStyle"};
 for(const [id,field] of Object.entries(map)){
  const control=$(id);if(!control)continue;
  if([...control.options].some(opt=>opt.value===tactics[field]))control.value=tactics[field];
  control.addEventListener("change",()=>{
   tactics[field]=control.value;
   write(TKEY,tactics);
   $("v6-tactic-status").textContent="Taktik senaryosu değişti. Yeni varsayımlarla sonucu görmek için 'Simüle Et' düğmesine bas.";
  });
 }
}
function afterSimulation(report){
 lastResult=report;
 if(!report?.model)return;
 const dist=report.scoreGrid||ENGINE().grid(report.model.home,report.model.away,report.model.rho);
 renderMain(report.model,dist);scenarioCandidates();
 const p=$("v6-case-result");p.replaceChildren(node("p","placeholder","İlk 11'den futbolcu seçip alternatif sonucu karşılaştır."));
}
function setup(){
 if(!$("v6-backtest")||!ENGINE()||!API())return;
 renderTactics();
 $("v6-backtest").addEventListener("click",runBacktest);
 $("v6-xg-import").addEventListener("click",importXg);
 $("v6-xg-reset").addEventListener("click",removeXg);
 $("v6-case-side").addEventListener("change",scenarioCandidates);
 $("v6-compare").addEventListener("click",compare);
 const refresh=()=>setTimeout(()=>{scenarioCandidates();const st=useMatch();
  if(lastResult&&(st.home!==lastResult.home||st.away!==lastResult.away||st.league!==lastResult.league)){
   lastResult=null;$("v6-model-summary").replaceChildren(node("p","placeholder","Takım veya turnuva değişti. Güncel simülasyonu yeniden çalıştır."));
  }
 },80);
 document.addEventListener("click",e=>{
  if(e.target.closest?.(".league")||e.target.closest?.(".fixture-item")||e.target.closest?.(".quick-match"))refresh();
 });
 ["team-home","team-away"].forEach(id=>$(id).addEventListener("change",refresh));
 scenarioCandidates();
 $("v6-xg-status").textContent=xg.length+" geçmiş kullanıcı xG kaydı yüklü. Beklenen CSV: date,home,away,home_xg,away_xg,league,source. Kaynak ve veri lisansını kontrol et.";
}
window.SIMULAB_V6={getTactics,getXgRows,afterSimulation,runBacktest};
setup();
})();
