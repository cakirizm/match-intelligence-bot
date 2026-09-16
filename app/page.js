'use client';

import {useEffect,useMemo,useState} from 'react';

const pct=v=>v==null?'-':`${(Number(v)*100).toFixed(1)}%`;
const edge=v=>v==null?'-':`${v>=0?'+':''}${(Number(v)*100).toFixed(1)} puan`;
const pp=v=>v==null?'-':`${v>=0?'+':''}${(Number(v)*100).toFixed(1)} puan`;
const n1=v=>v==null?'-':Number(v).toFixed(2);
const statusClass=s=>s==='VALUE'?'value':s==='İZLE'?'watch':'pass';

function MatchCard({item,onOpen}){
  const {fixture,analysis,importMeta}=item,d=new Date(fixture.starting_at||'');
  if(analysis.pending)return <button className="match-card" onClick={()=>onOpen(item)}>
    <div className="match-top"><div><span className="league">{fixture.league?.name||'Lig'}</span><span className="time">{Number.isNaN(d.getTime())?'':d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div><span className="status ready">EŞLEŞTİ</span></div>
    <div className="teams"><strong>{analysis.teams.home}</strong><span>vs</span><strong>{analysis.teams.away}</strong></div>
    <div className="pending-box"><b>Derin analiz için aç</b><span>API-Football eşleşme {(Number(importMeta?.matchScore||0)*100).toFixed(0)}% {importMeta?.crossChecked?'· football-data doğrulandı':''}</span></div>
  </button>;
  return <button className="match-card" onClick={()=>onOpen(item)}>
    <div className="match-top"><div><span className="league">{fixture.league?.name||'Lig'}</span><span className="time">{Number.isNaN(d.getTime())?'':d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div><span className={`status ${statusClass(analysis.status)}`}>{analysis.status}</span></div>
    <div className="teams"><strong>{analysis.teams.home}</strong><span>vs</span><strong>{analysis.teams.away}</strong></div>
    <div className="prob-row"><div><small>1</small><b>{pct(analysis.probabilities.home)}</b></div><div><small>X</small><b>{pct(analysis.probabilities.draw)}</b></div><div><small>2</small><b>{pct(analysis.probabilities.away)}</b></div></div>
    <div className="pick-row"><div><small>En büyük fiyat farkı</small><strong>{analysis.bestPick.label}</strong></div><div><small>Oran</small><strong>{analysis.bestPick.odd?.toFixed?.(2)||analysis.bestPick.odd||'-'}</strong></div><div className="edge"><small>Edge</small><strong>{edge(analysis.bestPick.edge)}</strong></div></div>
    <div className="quality"><span style={{width:`${analysis.quality}%`}}/></div><div className="quality-label">Veri yeterliliği {analysis.dataSufficiency||'-'} · {analysis.quality}/100</div>
  </button>;
}

function ProbabilityTable({analysis}){
  const rows=analysis.transparency?.marketTable||[];
  if(!rows.length)return null;
  return <div className="table-wrap"><table className="analysis-table"><thead><tr><th>Sonuç</th><th>Oran</th><th>Piyasa</th><th>Model</th><th>Edge</th></tr></thead><tbody>{rows.map(r=><tr key={r.key}><td><b>{r.label}</b></td><td>{r.odd??'-'}</td><td>{pct(r.market)}</td><td>{pct(r.model)}</td><td className={Number(r.edge)>0?'positive':''}>{edge(r.edge)}</td></tr>)}</tbody></table></div>;
}

function ModelBreakdown({analysis}){
  const models=analysis.transparency?.models||[];
  return <div className="model-grid">{models.map(m=><div className={`model-box ${m.available?'active-model':'inactive-model'}`} key={m.id}>
    <div className="model-title"><b>{m.name}</b><span>{m.available?'AKTİF':'VERİ YOK'}</span></div>
    {m.available?<><div className="model-probs"><span>1 <b>{pct(m.probs?.home)}</b></span><span>X <b>{pct(m.probs?.draw)}</b></span><span>2 <b>{pct(m.probs?.away)}</b></span></div><p>{m.note}</p><small>Ağırlık {(m.weight*100).toFixed(0)}% {m.supportsBest?'· seçili edge’i teyit ediyor':''}</small></>:<p>Bu model için gerekli veri gelmedi; final yüzdeye dahil edilmedi.</p>}
  </div>)}</div>;
}

function FormCard({title,data}){
  if(!data)return <div className="form-card"><h4>{title}</h4><p className="muted">Veri yok</p></div>;
  return <div className="form-card"><h4>{title}</h4><div className="metric-row"><span>Maç<b>{data.played}</b></span><span>PPG<b>{n1(data.ppg)}</b></span><span>Gol/maç<b>{n1(data.gf)}</b></span><span>Yenen<b>{n1(data.ga)}</b></span></div><div className="wdl"><b>{data.w}G</b><b>{data.d}B</b><b>{data.l}M</b></div></div>;
}

function RecentMatches({title,data}){
  const items=data?.items||[];if(!items.length)return null;
  return <div className="recent-list"><h4>{title}</h4>{items.map((x,i)=><div key={`${x.date}-${i}`}><span>{x.date?new Date(x.date).toLocaleDateString('tr-TR'):'-'}</span><b>{x.opponent||'-'}</b><strong>{x.gf}-{x.ga}</strong></div>)}</div>;
}

function InjuryList({title,data}){
  return <div className="injury-box"><h4>{title} <span>{data?.count||0}</span></h4>{data?.list?.length?data.list.map((x,i)=><div key={`${x.name}-${i}`}><b>{x.name}</b><span>{x.type} · {x.reason}</span></div>):<p className="muted">Kayıt yok</p>}</div>;
}

function Detail({item,close,onAnalyzed}){
  const [data,setData]=useState(null),[error,setError]=useState('');const source=item.fixture.source;
  useEffect(()=>{let alive=true;const url=source==='api-football'?`/api/api-football-fixture/${item.fixture.id}`:`/api/fixture/${item.fixture.id}`;fetch(url,{cache:'no-store'}).then(r=>r.json()).then(x=>{if(!alive)return;if(x.error)throw new Error(x.error);setData(x);if(source==='api-football')onAnalyzed?.(item.fixture.id,x.analysis)}).catch(e=>alive&&setError(e.message));return()=>{alive=false}},[item.fixture.id,source]);
  const a=data?.analysis;
  return <div className="drawer-backdrop" onClick={close}><aside className="drawer wide" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}>×</button>{error&&<div className="error">{error}</div>}{!data&&!error&&<div className="loading">Son 20 maç, ev/deplasman formu, sezon gücü, oran, H2H, eksikler ve dinlenme verileri birleştiriliyor…</div>}{a&&<>
    <div className="detail-head"><div><small>{data.fixture.league?.name||'Lig'}</small><h2>{a.teams.home} <em>vs</em> {a.teams.away}</h2></div><span className={`status ${statusClass(a.status)}`}>{a.status}</span></div>
    <div className={`verdict ${a.dataSufficiency==='DÜŞÜK'?'low':a.dataSufficiency==='ORTA'?'medium':'high'}`}><div><small>Model kararı</small><strong>{a.status} · {a.bestPick.label} {pct(a.bestPick.prob)}</strong><p>{a.decisionReason}</p></div><div><small>Veri yeterliliği</small><b>{a.dataSufficiency}</b><span>{a.quality}/100</span></div></div>
    <div className="hero-metric"><small>En büyük model-piyasa farkı</small><strong>{a.bestPick.label} · {pct(a.bestPick.prob)}</strong><span>Edge: {edge(a.bestPick.edge)} · {a.transparency?.independentModelCount||0} bağımsız model · {a.transparency?.supportCount||0} teyit</span></div>

    <section><h3>Piyasa ↔ model karşılaştırması</h3><ProbabilityTable analysis={a}/><p className="section-note">Piyasa yüzdeleri 1/oran hesaplanıp bookmaker marjı temizlenerek bulunur. Edge = model olasılığı − marj temizlenmiş piyasa olasılığı.</p></section>

    <section><h3>Nasıl hesaplandı?</h3><ModelBreakdown analysis={a}/><div className="rule-box"><b>VALUE kuralı</b><span>{a.transparency?.rule}</span></div>{a.transparency?.adjustments?.map((x,i)=><div className="adjustment" key={i}><span>{x.name}</span><b>{pp(x.value)}</b><small>{x.note}</small></div>)}</section>

    <section><h3>Form ve gol profili</h3><div className="form-grid"><FormCard title={`${a.teams.home} · son 20`} data={a.raw?.recent?.home?.overall}/><FormCard title={`${a.teams.away} · son 20`} data={a.raw?.recent?.away?.overall}/><FormCard title={`${a.teams.home} · ev maçları`} data={a.raw?.recent?.home?.venue}/><FormCard title={`${a.teams.away} · deplasman`} data={a.raw?.recent?.away?.venue}/></div>{a.expectedGoals&&<div className="goal-box"><div><small>Poisson beklenen gol λ</small><b>{n1(a.expectedGoals.home)} - {n1(a.expectedGoals.away)}</b></div>{a.goalMarkets&&<><div><small>2.5 Üst model</small><b>{pct(a.goalMarkets.over25)}</b></div><div><small>KG Var model</small><b>{pct(a.goalMarkets.btts)}</b></div></>}</div>}{a.goalMarkets?.topScores?.length>0&&<div className="score-chips">{a.goalMarkets.topScores.map(x=><span key={x.score}>{x.score} <b>{pct(x.prob)}</b></span>)}</div>}<div className="recent-grid"><RecentMatches title={`${a.teams.home} son maçlar`} data={a.raw?.recent?.home?.overall}/><RecentMatches title={`${a.teams.away} son maçlar`} data={a.raw?.recent?.away?.overall}/></div></section>

    <section><h3>Lig / sezon gücü</h3><div className="grid2"><div className="summary-box"><p><b>{a.teams.home}</b></p><p>Sıra: {a.raw?.standings?.home?.rank??'-'} · Puan: {a.raw?.standings?.home?.points??'-'} · PPG: {n1(a.raw?.standings?.home?.ppg)}</p><p>Sezon gol: {n1(a.raw?.season?.home?.gf)} / yenen {n1(a.raw?.season?.home?.ga)}</p><p>Ev gol: {n1(a.raw?.season?.home?.gfHome)} / yenen {n1(a.raw?.season?.home?.gaHome)}</p></div><div className="summary-box"><p><b>{a.teams.away}</b></p><p>Sıra: {a.raw?.standings?.away?.rank??'-'} · Puan: {a.raw?.standings?.away?.points??'-'} · PPG: {n1(a.raw?.standings?.away?.ppg)}</p><p>Sezon gol: {n1(a.raw?.season?.away?.gf)} / yenen {n1(a.raw?.season?.away?.ga)}</p><p>Dep gol: {n1(a.raw?.season?.away?.gfAway)} / yenen {n1(a.raw?.season?.away?.gaAway)}</p></div></div></section>

    <section><h3>Eksikler</h3><div className="grid2"><InjuryList title={a.teams.home} data={a.raw?.injuries?.home}/><InjuryList title={a.teams.away} data={a.raw?.injuries?.away}/></div><p className="section-note">API oyuncu dakikası/önemini vermiyorsa eksiklerin toplam etkisi güvenlik için ±3 olasılık puanıyla sınırlandırılır; “16 kayıt = 16 önemli oyuncu” varsayımı yapılmaz.</p></section>

    <section><h3>H2H ve dinlenme</h3><div className="grid2"><div className="summary-box"><p><b>Dinlenme</b></p><p>{a.teams.home}: {a.raw?.rest?.home?.restDays==null?'-':`${a.raw.rest.home.restDays.toFixed(1)} gün`} · son 7 günde {a.raw?.rest?.home?.matches7??'-'} maç</p><p>{a.teams.away}: {a.raw?.rest?.away?.restDays==null?'-':`${a.raw.rest.away.restDays.toFixed(1)} gün`} · son 7 günde {a.raw?.rest?.away?.matches7??'-'} maç</p></div><div className="summary-box"><p><b>H2H</b></p>{a.raw?.h2h?.length?a.raw.h2h.map((x,i)=><p key={i}>{x.date?new Date(x.date).toLocaleDateString('tr-TR'):'-'} · {x.home} {x.score} {x.away}</p>):<p className="muted">H2H verisi yok</p>}</div></div></section>

    <section><h3>Veri katmanları</h3>{a.signals.map((s,i)=><div className="signal" key={i}><span className={`dot ${s.ok?'ok':''}`}/><span>{s.name}</span><b>{s.text}</b></div>)}{data.coverage&&<div className="coverage"><b>{data.coverage.successful}/{data.coverage.total} API katmanı başarılı</b><span>Yaklaşık {data.coverage.requestsApprox} istek · 10 dk cache</span>{data.coverage.failed?.length>0&&<small>Eksik: {data.coverage.failed.join(', ')}</small>}</div>}</section>

    <section><h3>Model notu</h3><div className="summary-box"><p><b>Kaynak:</b> {a.source}</p><p><b>Bağımsız model:</b> {a.transparency?.independentModelCount||0} · <b>Final yön teyidi:</b> {a.transparency?.modelAgreement||0}</p><p className="muted">Bu motor sonuç garantisi vermez. Amaç; ayrı model ailelerini, gerçek ham verileri ve piyasa fiyatını aynı ekranda karşılaştırıp zayıf veri varsa otomatik PAS demektir.</p></div></section>
  </>}</aside></div>;
}

export default function Home(){
  const today=new Date().toISOString().slice(0,10);
  const [date,setDate]=useState(today),[liveData,setLiveData]=useState(null),[importData,setImportData]=useState(null),[importText,setImportText]=useState(''),[importLoading,setImportLoading]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('ALL'),[query,setQuery]=useState(''),[openItem,setOpenItem]=useState(null),[lastRefresh,setLastRefresh]=useState(null);
  const load=async()=>{try{setError('');const r=await fetch(`/api/fixtures?date=${date}`,{cache:'no-store'}),x=await r.json();if(!r.ok||x.error)throw new Error(x.error||'Veri alınamadı');setLiveData(x);setLastRefresh(new Date())}catch(e){setError(e.message)}};
  useEffect(()=>{setImportData(null);load()},[date]);
  useEffect(()=>{const t=setInterval(()=>{if(!importData)load()},5*60*1000);return()=>clearInterval(t)},[date,importData]);
  const doImport=async()=>{if(!importText.trim())return;setImportLoading(true);setError('');try{const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,text:importText})}),x=await r.json();if(!r.ok||x.error)throw new Error(x.error||'İçe aktarma başarısız');setImportData(x);setFilter('ALL')}catch(e){setError(e.message)}finally{setImportLoading(false)}};
  const analyzed=(id,analysis)=>setImportData(prev=>prev?{...prev,fixtures:prev.fixtures.map(x=>x.fixture.id===id?{...x,analysis:{...analysis,pending:false}}:x)}:prev);
  const data=importData||liveData;
  const fixtures=useMemo(()=>{const rows=data?.fixtures||[];return rows.filter(({fixture,analysis})=>{if(filter!=='ALL'&&analysis.status!==filter)return false;if(query&&!`${fixture.name||''} ${fixture.league?.name||''}`.toLowerCase().includes(query.toLowerCase()))return false;return true}).sort((a,b)=>(b.analysis.bestPick?.edge||0)-(a.analysis.bestPick?.edge||0))},[data,filter,query]);
  const counts=useMemo(()=>{const r=data?.fixtures||[];return {all:r.length,ready:r.filter(x=>x.analysis.status==='HAZIR').length,value:r.filter(x=>x.analysis.status==='VALUE').length,watch:r.filter(x=>x.analysis.status==='İZLE').length,pass:r.filter(x=>x.analysis.status==='PAS').length}},[data]);
  return <main>
    <header className="header"><div><div className="brand-mark">MI</div><div><h1>Match Intelligence</h1><p>Toplu maç · çoklu veri kaynağı · açıklanabilir analiz motoru</p></div></div><div className={`live-badge ${data?.mode!=='demo'?'on':''}`}><span/>{importData?'TOPLU LİSTE':data?.mode==='live'?'CANLI API':'DEMO'}</div></header>
    <section className="controlbar"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><input className="search" placeholder="Takım veya lig ara…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>importData?doImport():load()}>Yenile</button><div className="refresh">{lastRefresh?`Son güncelleme ${lastRefresh.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`:'Hazır'}</div></section>
    <section className="import-panel"><div><h2>Maçları toplu ekle</h2><p>Her satıra bir maç: <b>Galatasaray - Fenerbahçe</b>. Seçili tarihte API-Football fikstürüyle tek seferde eşleştirilir.</p></div><textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'Galatasaray - Fenerbahçe\nArsenal - Manchester City\nReal Madrid - Villarreal'}/><div className="import-actions"><button onClick={doImport} disabled={importLoading}>{importLoading?'Eşleştiriliyor…':'Listeyi eşleştir'}</button>{importData&&<button className="ghost" onClick={()=>setImportData(null)}>Otomatik fikstüre dön</button>}<span>{importData?`${importData.requested} satır · ${importData.matched} eşleşti · ${importData.unmatched} eşleşmedi`:'API-Football ana kaynak · football-data ikinci kontrol'}</span></div>{importData?.unmatchedRows?.length>0&&<details className="unmatched"><summary>{importData.unmatchedRows.length} eşleşmeyen satırı göster</summary>{importData.unmatchedRows.map((x,i)=><div key={i}>{x.raw} — {x.reason}</div>)}</details>}</section>
    {data?.warning&&<div className="banner">{data.warning}</div>}{error&&<div className="error">{error}</div>}
    <section className="stats five"><button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}><small>Tüm maçlar</small><strong>{counts.all}</strong></button><button className={filter==='HAZIR'?'active':''} onClick={()=>setFilter('HAZIR')}><small>Eşleşti</small><strong>{counts.ready}</strong></button><button className={filter==='VALUE'?'active':''} onClick={()=>setFilter('VALUE')}><small>Value</small><strong>{counts.value}</strong></button><button className={filter==='İZLE'?'active':''} onClick={()=>setFilter('İZLE')}><small>İzle</small><strong>{counts.watch}</strong></button><button className={filter==='PAS'?'active':''} onClick={()=>setFilter('PAS')}><small>Pas</small><strong>{counts.pass}</strong></button></section>
    <div className="section-title"><div><h2>Maç tarayıcı</h2><p>{importData?'Eşleşen maça tıklayınca açıklanabilir derin analiz çalışır.':'Sportmonks otomatik fikstürü.'}</p></div><span>{fixtures.length} maç</span></div>
    <section className="matches">{fixtures.map(item=><MatchCard key={`${item.fixture.source||'sm'}-${item.fixture.id}`} item={item} onOpen={setOpenItem}/>)}</section>
    {!data&&!error&&<div className="loading">Maçlar taranıyor…</div>}{data&&!fixtures.length&&<div className="empty">Bu filtrede maç bulunamadı.</div>}{openItem&&<Detail item={openItem} close={()=>setOpenItem(null)} onAnalyzed={analyzed}/>} 
  </main>;
}
