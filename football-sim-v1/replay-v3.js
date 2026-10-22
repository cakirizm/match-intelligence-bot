/* SIMULAB V3 Replay. Synthetic event reconstruction from one Monte Carlo score path.
   NEVER label generated shot, pass, scorer or ball movement as observed match data. */
(() => {
"use strict";
const API=()=>window.SIMULAB_API,SCOUT=()=>window.SIMULAB_SCOUT;
const $=id=>document.getElementById(id);
const FORMATIONS={
 "4-3-3":["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"],
 "4-2-3-1":["GK","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW"],
 "4-4-2":["GK","DF","DF","DF","DF","MF","MF","MF","MF","FW","FW"],
 "3-5-2":["GK","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW"]};
const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const pct=n=>(100*n).toFixed(1)+"%";
const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
let replay=null,timer=null,simCount=5000;
function setup(){
 const root=$("replay-root");if(!root||!API())return;
 root.innerHTML='<div class="replay-header"><span id="r-home" class="rteam home">EV SAHİBİ</span><div><div id="r-clock" class="rclock">00:00</div><div id="r-score" class="rscore">0 - 0</div></div><span id="r-away" class="rteam away">DEPLASMAN</span></div>'+
 '<div class="replay-body"><div class="replay-pitch" id="r-pitch"><div class="rmid"></div><div class="rbox left"></div><div class="rbox right"></div><div id="r-player-layer"></div><span id="r-ball" class="rball"></span></div><div class="replay-timeline"><h3>MAÇ AKIŞI • SİMÜLE EDİLEN OLAYLAR</h3><div id="r-events"></div></div></div>'+
 '<div class="replay-actions"><button class="btn primary" id="r-play">▶ OYNAT</button><button class="btn outline" id="r-step">+1 DAKİKA</button><button class="btn outline" id="r-restart">↺ BAŞTAN</button><label for="r-speed">HIZ</label><select id="r-speed"><option value="1">1×</option><option value="5" selected>5×</option><option value="20">20×</option></select><span class="replay-chip" id="r-chip">Senaryo bekleniyor</span></div>'+
 '<div class="replay-analytics"><div class="replay-statbox"><h3>GOLCÜ İHTİMALLERİ / TÜM KOŞULAR</h3><div id="r-scorers"></div></div><div class="replay-statbox"><h3>GOLCÜ İKİLİLERİ / TÜM KOŞULAR</h3><div id="r-pairs"></div></div></div>'+
 '<div class="match-explain" id="r-explain">Bu saha hareketleri, şutlar, paslar, asistler ve golcüler gerçeğin kaydı değil; 1.000–10.000 skor örneklemesinden üretilen bir anlatımdır.</div>';
 $("r-play").addEventListener("click",()=>{if(!replay)return;if(timer)pause();else play()});
 $("r-step").addEventListener("click",()=>{if(!replay)return;pause();advance(1)});
 $("r-restart").addEventListener("click",()=>{if(!replay)return;pause();rewind()});
 $("r-speed").addEventListener("change",()=>{if(timer){pause();play()}});
 $("simulation-count").addEventListener("change",()=>{
  const n=Number($("simulation-count").value)||5000;simCount=n;
  $("simulate").textContent="▶ "+n.toLocaleString("tr-TR")+" MAÇI SİMÜLE ET";
  $("sim-n").textContent="0 / "+n.toLocaleString("tr-TR")+" SİMÜLASYON";
 });
 $("simulate").textContent="▶ 5.000 MAÇI SİMÜLE ET";
 document.addEventListener("click",e=>{
  if(e.target.closest?.(".league")||e.target.closest?.(".fixture-item")){pause();setTimeout(()=>{if(replay&&API().getState().home!==replay.home)empty()},30)}
 });
}
function empty(){
 pause();replay=null;
 $("r-player-layer").replaceChildren();$("r-events").replaceChildren();$("r-scorers").textContent="Önce maç simüle et";$("r-pairs").textContent="Önce maç simüle et";
 $("r-chip").textContent="Senaryo bekleniyor";$("r-score").textContent="0 - 0";$("r-clock").textContent="00:00";
}
function lineupFor(team){
 const st=API().getState();return API().getLineup(team)||st.homeXI;
}
function teamPlayers(team,side){
 const xi=lineupFor(team),roles=FORMATIONS[xi.formation]||FORMATIONS["4-3-3"];
 const positions={GK:0,DF:0,MF:0,FW:0},counts=roles.reduce((acc,k)=>(acc[k]=(acc[k]||0)+1,acc),{});
 return xi.players.map((person,i)=>{
  const role=roles[i],rank=positions[role]++,n=counts[role]||1;
  const lane=(rank+1)/(n+1),start=role==="GK"?9:role==="DF"?26:role==="MF"?49:73;
  const x=side==="home"?start:100-start,y=14+lane*72;
  const profile=person.name?SCOUT()?.getPlayer(team,person.name):null;
  const name=person.name||"Oyuncu #"+(i+1);
  return {id:side+"-"+i,number:i+1,name,confirmed:!!person.name,role,rating:Number(person.rating)||6.5,fitness:Number(person.fitness)||100,
   side,team,profile,x,y,goal:0,assist:0,shots:0,touches:0};
 });
}
function goalWeight(p){
 const base={GK:.005,DF:.13,MF:.62,FW:2.65}[p.role]||.4;
 const skill=clamp((p.rating-6.5)/3.5,-1,1),fitness=clamp(p.fitness/100,.5,1);
 let statsBoost=1;
 // Real performance signal only when compatible minutes+goals exist.
 if(p.profile&&p.profile.minutes>=300&&p.profile.goals!==null&&p.profile.goals!==undefined){
  const g90=90*Number(p.profile.goals)/p.profile.minutes;
  statsBoost=clamp(.7+g90/.35,.75,1.8);
 }
 // Basic position consistency: an attacker starting in a goalkeeper spot is not treated as full attacker.
 return Math.max(.003,base*(1+.18*skill)*fitness*statsBoost);
}
function chooseWeighted(list){
 if(!list.length)return null;
 const total=list.reduce((n,p)=>n+goalWeight(p),0);
 let r=Math.random()*total;
 for(const p of list){r-=goalWeight(p);if(r<=0)return p}
 return list[list.length-1];
}
function chooseAssister(list,scorer){
 const candidates=list.filter(p=>p.id!==scorer.id&&p.role!=="GK");
 return candidates.length?chooseWeighted(candidates):null;
}
function makeGoalSequence(h,a,homePlayers,awayPlayers){
 const events=[];
 for(const [goals,side,players] of [[h,"home",homePlayers],[a,"away",awayPlayers]]){
  for(let i=0;i<goals;i++){
   const scorer=chooseWeighted(players),assistant=Math.random()<.63?chooseAssister(players,scorer):null;
   events.push({minute:clamp(4+Math.floor(Math.random()*87),1,90),type:"goal",side,player:scorer.id,scorer:scorer.name,assist:assistant?.name||null,assistantId:assistant?.id||null});
  }
 }
 return events.sort((x,y)=>x.minute-y.minute);
}
function buildNarrative(trial,players,model){
 const [h,a]=trial,homes=players.filter(p=>p.side==="home"),aways=players.filter(p=>p.side==="away"),goals=makeGoalSequence(h,a,homes,aways);
 const events=[{minute:0,type:"kickoff",side:"home",player:null,label:"Başlangıç vuruşu"}];
 // 22 plausible non-scoring actions: illustrative rather than tracked possessions.
 for(let i=0;i<26;i++){
  const minute=3+Math.floor(Math.random()*87),side=Math.random()<(model.home/(model.home+model.away))?"home":"away";
  const picked=chooseWeighted(side==="home"?homes:aways);
  const type=Math.random()<.4?"shot":Math.random()<.7?"build":"chance";
  const dictionary={shot:"Şut girişimi",build:"Paslarla hücum kuruluyor",chance:"Tehlikeli hücum"};
  events.push({minute,type,side,player:picked.id,label:dictionary[type]+" • "+picked.name,
   x:side==="home"?45+Math.random()*45:10+Math.random()*45,y:12+Math.random()*76});
 }
 events.push(...goals);
 events.push({minute:45,type:"break",side:null,player:null,label:"Devre arası"},{minute:90,type:"end",side:null,player:null,label:"Maç sona erdi"});
 events.sort((a,b)=>a.minute-b.minute||(a.type==="goal"?1:-1));
 return events;
}
function pitchPlayers(players){
 const layer=$("r-player-layer");layer.replaceChildren();
 for(const p of players){
  const e=mk("div","rplayer "+(p.side==="away"?"visitor":"")),badge=mk("span","rnum",p.number),label=mk("span","rname",p.confirmed?(p.name.split(" ").at(-1)||p.name):"#"+p.number);
  e.style.left=p.x+"%";e.style.top=p.y+"%";e.id="r-player-"+p.id;
  e.title=p.name+" • "+p.role+" • "+(p.confirmed?"Kullanıcının ilk 11'i":"İsim girilmedi");
  e.append(badge,label);layer.append(e);
 }
}
function scoreSummary(trials,homes,aways){
 // Scorer simulations use formation, user ratings and optional imported stats.
 // They do not represent observed player goals or verified real match contributions.
 const counts=new Map(),pairs=new Map(),duos=new Map();
 const remember=(map,key)=>map.set(key,(map.get(key)||0)+1);
 for(const [h,a] of trials){
  const hs=[],as=[];
  for(let i=0;i<h;i++){const p=chooseWeighted(homes);if(p){remember(counts,p.id);hs.push(p)}}
  for(let i=0;i<a;i++){const p=chooseWeighted(aways);if(p){remember(counts,p.id);as.push(p)}}
  const uniqueH=[...new Set(hs.map(p=>p.id))],uniqueA=[...new Set(as.map(p=>p.id))];
  // Pair categories: one scorer from each team in the same simulated match.
  for(const hId of uniqueH)for(const aId of uniqueA)remember(pairs,hId+"|"+aId);
  for(const list of [uniqueH,uniqueA])for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)remember(duos,list[i]+"|"+list[j]);
 }
 return {counts,pairs,duos};
}
function miniLine(root,a,b){
 const row=mk("div","replay-playerline");
 row.append(mk("span",null,a),mk("b",null,b));root.append(row);
}
function renderPlayerSummary(stats,players,runs){
 const byId=new Map(players.map(p=>[p.id,p]));
 const root=$("r-scorers"),pairs=$("r-pairs");root.replaceChildren();pairs.replaceChildren();
 if(!players.some(p=>p.confirmed)){
  root.append(mk("p","placeholder","Oyuncu bazlı tahmin için önce ilk 11'e isim gir."));
  pairs.append(mk("p","placeholder","Golcü ikilileri için isimli ilk 11 gerekli."));
  return;
 }
 const candidates=[...stats.counts.entries()].filter(([id])=>byId.get(id)?.confirmed).sort((a,b)=>b[1]-a[1]).slice(0,6);
 if(candidates.length)for(const [id,n] of candidates){const p=byId.get(id);miniLine(root,p.name+" ("+(p.side==="home"?"EV":"DEP")+")",pct(n/runs))}
 else root.append(mk("p","placeholder","Yeterli skor örneklemesi bulunamadı."));
 const candidates2=[...stats.pairs.entries(),...stats.duos.entries()].filter(([k])=>k.split("|").every(id=>byId.get(id)?.confirmed)).sort((a,b)=>b[1]-a[1]).slice(0,5);
 if(candidates2.length)for(const [key,n] of candidates2){const names=key.split("|").map(id=>byId.get(id).name.split(" ").at(-1));miniLine(pairs,names.join(" + "),pct(n/runs))}
 else pairs.append(mk("p","placeholder","Kadro henüz tamamlanmamış veya eşleşen golcü çifti oluşmamış."));
}
function renderExplainer(model,runs,players,score){
 const used=players.filter(p=>p.confirmed).length;
 const known=players.filter(p=>p.profile).length;
 const imported=players.filter(p=>p.profile?.minutes!==null&&p.profile?.minutes!==undefined).length;
 $("r-explain").textContent="Senaryo: "+score.join("-")+" skoruna sahip "+runs.toLocaleString("tr-TR")+" Monte Carlo koşusundan temsilî bir maç. "+
 "Tahmini gol oranları (gerçek xG değil): "+model.home.toFixed(2)+" / "+model.away.toFixed(2)+". "+
 "Manuel bağlam/kadro ayarı: EV "+((model.homeFactor-1)*100).toFixed(1)+"%, DEP "+((model.awayFactor-1)*100).toFixed(1)+"%. "+
 "İsim girilmiş ilk 11: "+used+"/22; kaynaklı temel profil: "+known+"; dakika/gol veri alanı mevcut: "+imported+". "+
 "Top hareketleri, golcüler, şutlar, asistler ve golcü ikilisi olasılıkları model tarafından oluşturulur, gerçek maç aksiyonları değildir. "+
 "0-0, 1-0 ve 1-1 gibi skorlar futbolda geçerli olduğundan yapay biçimde elenmez.";
}
function scoreName(id){return replay.players.find(p=>p.id===id)?.name||""}
function matchEvent(event){
 const row=mk("div","replay-event"+(event.type==="goal"?" goal":""));
 row.append(mk("span","min",event.minute+"'"));
 if(event.type==="goal"){
  row.append(mk("b",null,"⚽ GOL! "+event.scorer),mk("span",null,event.assist?"Asist: "+event.assist:"Asist kaydı: model üretmedi"));
 }else row.append(mk("span",null,event.label||event.type));
 row.append(mk("span","origin","Simüle olay · gözlemlenmiş veri değil"));
 $("r-events").append(row);
 const timeline=$("r-events").parentElement;timeline.scrollTop=timeline.scrollHeight;
}
function updateAtMinute(){
 if(!replay)return;
 const r=replay;
 $("r-clock").textContent=String(r.minute).padStart(2,"0")+":00";
 $("r-score").textContent=r.homeScore+" - "+r.awayScore;
 const ch=$("r-chip");ch.textContent="TEMSiLÎ | "+r.minute+" / 90";
 const ball=$("r-ball");
 const last=r.recentEvent;
 if(last){
  const player=r.players.find(p=>p.id===last.player);
  ball.style.left=(last.x!==undefined?last.x:player?player.x:50)+"%";
  ball.style.top=(last.y!==undefined?last.y:player?player.y:50)+"%";
  for(const p of r.players){const el=$("r-player-"+p.id);el?.classList.toggle("ractive",p.id===last.player)}
 }
}
function rewind(){
 if(!replay)return;
 replay.minute=0;replay.idx=0;replay.homeScore=0;replay.awayScore=0;replay.recentEvent=null;
 $("r-events").replaceChildren();$("r-play").textContent="▶ OYNAT";
 updateAtMinute();
}
function pause(){
 if(timer!==null){clearInterval(timer);timer=null}
 const b=$("r-play");if(b)b.textContent="▶ OYNAT";
}
function play(){
 if(!replay)return;
 if(replay.minute>=90)rewind();
 if(timer)return;
 $("r-play").textContent="Ⅱ DURAKLAT";
 const speeds={"1":380,"5":95,"20":27},delay=speeds[$("r-speed").value]||95;
 timer=setInterval(()=>advance(1),delay);
}
function advance(steps){
 if(!replay)return;
 const r=replay;
 for(let i=0;i<steps&&r.minute<90;i++){
  r.minute++;
  while(r.idx<r.events.length&&r.events[r.idx].minute<=r.minute){
   const event=r.events[r.idx++];r.recentEvent=event;
   if(event.type==="goal"){if(event.side==="home")r.homeScore++;else r.awayScore++}
   matchEvent(event);
  }
 }
 updateAtMinute();
 if(r.minute>=90){pause();$("r-chip").textContent="MAÇ BİTTİ • TEMSiLÎ";}
}
function prepare(result){
 pause();
 const {trials,home,away,model,runCount}=result;
 if(!Array.isArray(trials)||!trials.length)return;
 const counts=new Map();for(const [a,b] of trials){const k=a+"-"+b;counts.set(k,(counts.get(k)||0)+1)}
 const [scoreKey,count]=[...counts].sort((a,b)=>b[1]-a[1])[0];
 const score=scoreKey.split("-").map(Number);
 const homes=teamPlayers(home,"home"),aways=teamPlayers(away,"away"),players=[...homes,...aways];
 const stats=scoreSummary(trials,homes,aways),events=buildNarrative(score,players,model);
 replay={home,away,score,modalProbability:count/runCount,players,events,model,runCount,minute:0,idx:0,homeScore:0,awayScore:0,recentEvent:null};
 $("r-home").textContent=home;$("r-away").textContent=away;
 pitchPlayers(players);
 renderPlayerSummary(stats,players,runCount);
 renderExplainer(model,runCount,players,score);
 $("r-chip").textContent="EN SIK SKOR "+score.join("-")+" · "+pct(count/runCount);
 rewind();$("r-chip").textContent="EN SIK SKOR "+score.join("-")+" · "+pct(count/runCount);
}
function rerender(){
 if(!replay)return;
 const {home,away,model,runCount,score}=replay;
 const players=[...teamPlayers(home,"home"),...teamPlayers(away,"away")];
 replay.players=players;replay.events=buildNarrative(score,players,model);
 pitchPlayers(players);renderExplainer(model,runCount,players,score);rewind();
}
window.SIMULAB_REPLAY={onComplete:prepare,rerender};
setup();
})();