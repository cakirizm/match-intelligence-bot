function norm(s=''){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b(fc|cf|fk|sc|sk|afc|ac|club|football|futbol)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}

function tokens(s){return new Set(norm(s).split(' ').filter(Boolean))}
function sim(a,b){
  const x=norm(a),y=norm(b); if(!x||!y)return 0;if(x===y)return 1;if(x.includes(y)||y.includes(x))return .9;
  const A=tokens(a),B=tokens(b),inter=[...A].filter(t=>B.has(t)).length,union=new Set([...A,...B]).size;
  const j=union?inter/union:0;
  return Math.min(1,j*.78+(x[0]===y[0]?.[0]?0:.0)+(A.size&&B.size&&[...A].some(t=>[...B].some(u=>u.startsWith(t)||t.startsWith(u)))?.16:0));
}

export function parseMatchLines(text=''){
  return String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((raw,index)=>{
    const cleaned=raw.replace(/^\s*\d{1,2}[:.]\d{2}\s+/, '').replace(/^\s*\d+[.)-]\s+/, '');
    const parts=cleaned.split(/\s+(?:-|–|—|vs\.?|v)\s+/i);
    if(parts.length<2)return {index,raw,error:'Ev sahibi - deplasman formatı bulunamadı'};
    let home=parts[0].trim();let away=parts.slice(1).join(' - ').trim();
    away=away.replace(/\s+(?:\d+[.,]\d+\s*){2,6}$/,'').trim();
    return {index,raw,home,away};
  });
}

export function matchApiFootballLine(line,fixtures=[]){
  if(line.error)return {...line,matched:false};
  let best=null,bestScore=0;
  for(const f of fixtures){
    const h=f?.teams?.home?.name||'',a=f?.teams?.away?.name||'';
    const direct=(sim(line.home,h)+sim(line.away,a))/2;
    const reverse=(sim(line.home,a)+sim(line.away,h))/2*.92;
    const score=Math.max(direct,reverse);
    if(score>bestScore){bestScore=score;best=f}
  }
  if(!best||bestScore<.52)return {...line,matched:false,score:bestScore};
  return {...line,matched:true,score:bestScore,fixture:best};
}

export function footballDataCrossCheck(line,matches=[]){
  if(!line.home||!line.away)return null;
  let best=null,bestScore=0;
  for(const m of matches){
    const h=m?.homeTeam?.name||m?.homeTeam?.shortName||'',a=m?.awayTeam?.name||m?.awayTeam?.shortName||'';
    const score=(sim(line.home,h)+sim(line.away,a))/2;
    if(score>bestScore){bestScore=score;best=m}
  }
  return bestScore>=.55?{match:best,score:bestScore}:null;
}
