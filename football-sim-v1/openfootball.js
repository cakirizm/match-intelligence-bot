/* SIMULAB V1.1 — OpenFootball CC0 JSON adapter.
   Source: https://github.com/openfootball/football.json
   OpenFootball files are published under CC0-1.0.
   All downloaded match records remain in this browser's localStorage. */
(function(){
  "use strict";
  const DATASET_BASE="https://raw.githubusercontent.com/openfootball/football.json/master";
  const MIRROR_BASE="https://cdn.jsdelivr.net/gh/openfootball/football.json@master";
  const CODE={eng:"en",esp:"es",ger:"de",ita:"it",fra:"fr",tur:"tr"};
  const SEASONS=["2026-27","2025-26","2024-25","2023-24","2022-23"];
  const META_KEY="simulab-metadata-v1",FIXTURE_KEY="simulab-fixtures-v1";
  let meta=read(META_KEY),allFixtures=read(FIXTURE_KEY),busy=false;
  function read(key){try{const x=JSON.parse(localStorage.getItem(key)||"{}");return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}catch{return {}}}
  const $=id=>document.getElementById(id);
  const today=()=>new Date().toISOString().slice(0,10);
  const short=(str)=>String(str||"").slice(0,10);
  const safeDate=(str)=>/^\d{4}-\d\d-\d\d$/.test(str)&&!Number.isNaN(Date.parse(str));
  function normalize(json,season){
    if(!json||!Array.isArray(json.matches))throw Error("Dosya maç listesi içermiyor.");
    const complete=[],fixtures=[];
    for(const m of json.matches){
      const date=short(m.date),home=String(m.team1||"").trim(),away=String(m.team2||"").trim();
      if(!safeDate(date)||!home||!away||home===away)continue;
      const score=Array.isArray(m.score)?m.score:(m.score&&Array.isArray(m.score.ft)?m.score.ft:null);
      const valid=score&&score.length>=2&&score.slice(0,2).every(v=>Number.isInteger(v)&&v>=0&&v<=30);
      if(valid&&date<=today())complete.push({date,home,away,hg:score[0],ag:score[1],season});
      else if(date>=today())fixtures.push({date,time:String(m.time||""),home,away,season});
    }
    return {complete,fixtures};
  }
  function dedupe(entries,withScore){
    const unique=new Map();
    for(const match of entries){
      if(!match||!safeDate(match.date)||!match.home||!match.away)continue;
      const key=match.date+"|"+match.home+"|"+match.away;
      if(!unique.has(key)||withScore)unique.set(key,match);
    }
    return Array.from(unique.values()).sort((a,b)=>a.date.localeCompare(b.date));
  }
  async function jsonAt(season,code){
    const path=season+"/"+CODE[code]+".1.json";
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      let result;
      try{result=await fetch(DATASET_BASE+"/"+path,{cache:"no-store",signal:controller.signal})}
      catch(e){result=await fetch(MIRROR_BASE+"/"+path,{cache:"no-store",signal:controller.signal})}
      if(result.status===404)return null;
      if(!result.ok)throw Error("HTTP "+result.status);
      return await result.json();
    }finally{clearTimeout(timer)}
  }
  function createButton(label,classes,handler){
    const button=document.createElement("button");button.type="button";button.className=classes;button.textContent=label;button.addEventListener("click",handler);return button;
  }
  function setup(){
    const upload=document.querySelector(".upload");
    const section=document.createElement("div");section.style.cssText="padding:14px;border:1px solid #3a766a;border-radius:13px;background:#0c2c30;margin:10px 0 17px";
    const title=document.createElement("strong");title.textContent="Ücretsiz otomatik veri aktarımı";
    const expl=document.createElement("p");expl.style.cssText="margin:7px 0 12px;color:#b7cbd3;font-size:12px";expl.textContent="OpenFootball'dan son beş sezonun tamamlanmış maçlarını ve mevcut fikstürleri indirir. API anahtarı gerekmez.";
    const btns=document.createElement("div");btns.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
    const one=createButton("Seçili Ligi Güncelle","btn",()=>update(false));
    const all=createButton("6 Ligi Güncelle","btn primary",()=>update(true));
    one.id="sync-one";all.id="sync-all";btns.append(one,all);
    const note=document.createElement("p");note.style.cssText="font-size:11px;color:#a4bfc7;margin:10px 0 0";note.textContent="Kaynak: openfootball/football.json (CC0). Güncellik, açık veri projesinin yayın hızına bağlıdır.";
    section.append(title,expl,btns,note);
    upload.before(section);
    const banner=document.createElement("div");banner.id="sync-banner";banner.style.cssText="margin:0 0 16px;padding:12px 16px;border:1px solid #365068;border-radius:12px;background:#10263a;color:#b7d0df;font-size:12px";document.querySelector(".intro").after(banner);
    const fixturesCard=document.createElement("section");fixturesCard.className="card";fixturesCard.innerHTML='<div class="head"><h2>Yaklaşan karşılaşmalar</h2><span class="label">GERÇEK FİKSTÜR</span></div><div class="list" id="upcoming"><p class="empty">Önce maç verilerini güncelleyin.</p></div>';
    $("history").closest(".card").before(fixturesCard);
    const originalSelect=selectLeague;
    selectLeague=function(key){originalSelect(key);renderMetadata();renderFixtures()};
    $("modal").querySelector("p").textContent="Aşağıdaki otomatik güncelleme butonları OpenFootball maç sonuçlarını indirir. İsterseniz eski yöntemle kendi CSV dosyanızı da yükleyebilirsiniz.";
    renderMetadata();renderFixtures();
  }
  function renderMetadata(){
    const banner=$("sync-banner");if(!banner)return;
    const loaded=Object.values(meta).filter(x=>x&&x.count).length;
    const m=meta[league];
    if(!m){
      banner.textContent=loaded?loaded+" ligde OpenFootball kaydı var. Bu lig için henüz otomatik aktarım yapılmamış.":"Henüz gerçek OpenFootball verisi indirilmedi. Üstteki 'Verileri Güncelle' menüsünden 6 ligi tek seferde indirebilirsiniz.";
      return;
    }
    const latest=m.latestResult?new Date(m.latestResult+"T00:00:00Z"):null;
    const age=latest?Math.floor((Date.now()-latest.getTime())/86400000):null;
    const obsolete=age!==null&&age>21;
    const current="2026-27";
    const seasonFlag=m.seasons.includes(current)?"2026–27 dosyası mevcut":"2026–27 dosyası bulunamadı";
    banner.textContent=(obsolete?"⚠ ESKİ VERİ • ":"✓ AÇIK VERİ • ")+
      m.count+" maç / "+m.seasons.length+" sezon • En son sonuç: "+(m.latestResult||"bilinmiyor")+" • "+
      seasonFlag+" • Son kontrol: "+new Date(m.updatedAt).toLocaleString("tr-TR");
  }
  function renderFixtures(){
    const root=$("upcoming");if(!root)return;root.replaceChildren();
    const next=(allFixtures[league]||[]).filter(f=>f.date>=today()).slice(0,7);
    if(!next.length){const p=document.createElement("p");p.className="empty";p.textContent="Bu lig için güncel fikstür bulunamadı. Mevcut sezon verisi eksik olabilir.";root.append(p);return}
    for(const m of next){
      const button=createButton("","history",()=>{const h=$("home"),a=$("away");const teams=names();if(!teams.includes(m.home)||!teams.includes(m.away)){alert("Takımlardan biri henüz maç veri listesinde bulunmuyor.");return}h.value=m.home;a.value=m.away;fresh();choose();window.scrollTo({top:0,behavior:"smooth"})});
      button.style.cssText="width:100%;color:#e9f7ff;text-align:left;border:1px solid #31526b";
      const teams=document.createElement("span");teams.textContent=m.home+" – "+m.away;teams.style.cssText="font-weight:700";
      const date=document.createElement("small");date.textContent=m.date+(m.time?" · "+m.time:"");button.append(teams,date);root.append(button);
    }
  }
  function setStatus(message){
    const line=$("info");if(line)line.textContent=message;
    const banner=$("sync-banner");if(banner)banner.textContent=message;
  }
  async function updateLeague(key,progress){
    const results=[],fixtures=[],seasons=[],errors=[];
    for(const season of SEASONS){
      try{
        const json=await jsonAt(season,key);
        if(!json){errors.push(season+" bulunamadı");continue}
        const converted=normalize(json,season);
        results.push(...converted.complete);fixtures.push(...converted.fixtures);
        seasons.push(season);
      }catch(e){errors.push(season+": "+String(e.message||e))}
      progress(key+" • "+season+" kontrol edildi");
    }
    if(!seasons.length||!results.length)return {key,ok:false,error:errors.join("; ")||"Veri yok"};
    const previous=Array.isArray(db[key])?db[key]:[];
    const merged=dedupe([...previous,...results],true);
    const nextDb={...db,[key]:merged};
    const upcoming=dedupe(fixtures,false).filter(f=>f.date>=today());
    const nextFixtures={...allFixtures,[key]:upcoming};
    const latest=results.map(x=>x.date).sort().at(-1)||"";
    const nextMeta={...meta,[key]:{count:merged.length,source:"OpenFootball (CC0)",updatedAt:new Date().toISOString(),latestResult:latest,seasons,fixtures:upcoming.length,failed:errors}};
    try{
      localStorage.setItem("simulab-v1",JSON.stringify(nextDb));
      localStorage.setItem(FIXTURE_KEY,JSON.stringify(nextFixtures));
      localStorage.setItem(META_KEY,JSON.stringify(nextMeta));
      db=nextDb;allFixtures=nextFixtures;meta=nextMeta;
    }catch(e){return {key,ok:false,error:"Tarayıcı hafızası dolu veya kapalı: "+String(e.message||e)}}
    return {key,ok:true,count:merged.length,fixtures:upcoming.length,latest,season:seasons[0],warnings:errors.length};
  }
  async function update(all){
    if(busy)return;busy=true;
    const targets=all?Object.keys(CODE):[league],buttons=[$("sync-one"),$("sync-all")];
    buttons.forEach(b=>{b.disabled=true;b.textContent="İndiriliyor..."});
    let finished=0;
    setStatus("OpenFootball bağlantısı kuruluyor. "+targets.length+" lig güncellenecek.");
    try{
      const outcomes=await Promise.all(targets.map(async key=>{
        const ret=await updateLeague(key,(msg)=>setStatus("Veri indiriliyor: "+msg+" ("+finished+"/"+targets.length+" lig bitti)"));
        finished++;
        setStatus("İşlenen lig: "+finished+"/"+targets.length);
        return ret;
      }));
      selectLeague(league);
      const successes=outcomes.filter(x=>x.ok);
      const failures=outcomes.filter(x=>!x.ok);
      const msg=successes.length+" lig güncellendi, "+failures.length+" lig başarısız. "+
        successes.map(x=>leagues.find(t=>t[0]===x.key)[2]+": "+x.count+" maç / son "+x.latest).join(" | ")+
        (failures.length?" | Hata: "+failures.map(x=>x.key+" "+x.error).join(" / "):"");
      $("info").textContent=msg;
      renderMetadata();
      if(successes.length===0)alert("OpenFootball verileri alınamadı. İnternet bağlantınızı kontrol edin veya CSV yüklemeyi deneyin.");
    }catch(e){setStatus("Güncelleme başarısız: "+String(e.message||e))}
    finally{busy=false;buttons[0].disabled=false;buttons[1].disabled=false;buttons[0].textContent="Seçili Ligi Güncelle";buttons[1].textContent="6 Ligi Güncelle"}
  }
  setup();
})();