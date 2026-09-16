'use client';

import { useEffect, useMemo, useState } from 'react';

const pct=v=>`${(Number(v||0)*100).toFixed(1)}%`;
const edge=v=>`${v>=0?'+':''}${(Number(v||0)*100).toFixed(1)} puan`;

function MatchCard({item,onOpen}){
  const {fixture,analysis}=item;
  const d=new Date(String(fixture.starting_at||'').replace(' ','T'));
  return <button className="match-card" onClick={()=>onOpen(fixture.id)}>
    <div className="match-top"><div><span className="league">{fixture.league?.name||'Lig'}</span><span className="time">{Number.isNaN(d.getTime())?'':d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div><span className={`status ${analysis.status==='VALUE'?'value':analysis.status==='İZLE'?'watch':'pass'}`}>{analysis.status}</span></div>
    <div className="teams"><strong>{analysis.teams.home}</strong><span>vs</span><strong>{analysis.teams.away}</strong></div>
    <div className="prob-row"><div><small>1</small><b>{pct(analysis.probabilities.home)}</b></div><div><small>X</small><b>{pct(analysis.probabilities.draw)}</b></div><div><small>2</small><b>{pct(analysis.probabilities.away)}</b></div></div>
    <div className="pick-row"><div><small>En güçlü sinyal</small><strong>{analysis.bestPick.label}</strong></div><div><small>Oran</small><strong>{analysis.bestPick.odd?.toFixed?.(2)||analysis.bestPick.odd||'-'}</strong></div><div className="edge"><small>Edge</small><strong>{edge(analysis.bestPick.edge)}</strong></div></div>
    <div className="quality"><span style={{width:`${analysis.quality}%`}}/></div><div className="quality-label">Veri kalitesi {analysis.quality}/100</div>
  </button>;
}

function Detail({id,close}){
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;fetch(`/api/fixture/${id}`).then(r=>r.json()).then(x=>{if(!alive)return;if(x.error)throw new Error(x.error);setData(x)}).catch(e=>alive&&setError(e.message));return()=>{alive=false}},[id]);
  return <div className="drawer-backdrop" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}>×</button>{error&&<div className="error">{error}</div>}{!data&&!error&&<div className="loading">Detay analiz ediliyor…</div>}{data&&<>
    <div className="detail-head"><div><small>{data.fixture.league?.name||'Lig'}</small><h2>{data.analysis.teams.home} <em>vs</em> {data.analysis.teams.away}</h2></div><span className={`status ${data.analysis.status==='VALUE'?'value':data.analysis.status==='İZLE'?'watch':'pass'}`}>{data.analysis.status}</span></div>
    <div className="hero-metric"><small>En güçlü model sinyali</small><strong>{data.analysis.bestPick.label} · {pct(data.analysis.bestPick.prob)}</strong><span>Edge: {edge(data.analysis.bestPick.edge)} · Veri kalitesi {data.analysis.quality}/100</span></div>
    <div className="grid3"><div><small>MS 1</small><b>{pct(data.analysis.probabilities.home)}</b><span>Oran {data.analysis.odds.home||'-'}</span></div><div><small>X</small><b>{pct(data.analysis.probabilities.draw)}</b><span>Oran {data.analysis.odds.draw||'-'}</span></div><div><small>MS 2</small><b>{pct(data.analysis.probabilities.away)}</b><span>Oran {data.analysis.odds.away||'-'}</span></div></div>
    <section><h3>Analiz sinyalleri</h3>{data.analysis.signals.map((s,i)=><div className="signal" key={i}><span className={`dot ${s.ok?'ok':''}`}/><span>{s.name}</span><b>{s.text}</b></div>)}</section>
    <section><h3>Model özeti</h3><div className="summary-box"><p><b>Kaynak:</b> {data.analysis.source}</p>{data.analysis.expectedGoals&&<p><b>Beklenen gol:</b> {data.analysis.expectedGoals.home.toFixed(2)} - {data.analysis.expectedGoals.away.toFixed(2)}</p>}<p className="muted">Model olasılığı garanti değildir. Amaç piyasa fiyatı ile veri tabanlı olasılık arasındaki farkı ölçmektir.</p></div></section>
    {data.mode==='demo'&&<div className="demo-note">Demo modundasın. Vercel'e SPORTMONKS_API_TOKEN eklenince canlı maçlar gelir.</div>}
  </>}</aside></div>;
}

export default function Home(){
  const today=new Date().toISOString().slice(0,10);
  const [date,setDate]=useState(today),[data,setData]=useState(null),[error,setError]=useState(''),[filter,setFilter]=useState('ALL'),[query,setQuery]=useState(''),[openId,setOpenId]=useState(null),[lastRefresh,setLastRefresh]=useState(null);
  const load=async()=>{try{setError('');const r=await fetch(`/api/fixtures?date=${date}`,{cache:'no-store'}),x=await r.json();if(!r.ok||x.error)throw new Error(x.error||'Veri alınamadı');setData(x);setLastRefresh(new Date())}catch(e){setError(e.message)}};
  useEffect(()=>{load()},[date]);
  useEffect(()=>{const t=setInterval(load,5*60*1000);return()=>clearInterval(t)},[date]);

  const fixtures=useMemo(()=>{const rows=data?.fixtures||[];return rows.filter(({fixture,analysis})=>{if(filter!=='ALL'&&analysis.status!==filter)return false;if(query&&!`${fixture.name||''} ${fixture.league?.name||''}`.toLowerCase().includes(query.toLowerCase()))return false;return true}).sort((a,b)=>b.analysis.bestPick.edge-a.analysis.bestPick.edge)},[data,filter,query]);
  const counts=useMemo(()=>{const r=data?.fixtures||[];return {all:r.length,value:r.filter(x=>x.analysis.status==='VALUE').length,watch:r.filter(x=>x.analysis.status==='İZLE').length,pass:r.filter(x=>x.analysis.status==='PAS').length}},[data]);

  return <main>
    <header className="header"><div><div className="brand-mark">MI</div><div><h1>Match Intelligence</h1><p>Tüm maçlar · otomatik analiz · value motoru</p></div></div><div className={`live-badge ${data?.mode==='live'?'on':''}`}><span/>{data?.mode==='live'?'CANLI API':'DEMO'}</div></header>
    <section className="controlbar"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><input className="search" placeholder="Takım veya lig ara…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={load}>Yenile</button><div className="refresh">{lastRefresh?`Son güncelleme ${lastRefresh.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`:'Yükleniyor…'} · 5 dk otomatik</div></section>
    {data?.warning&&<div className="banner">{data.warning}</div>}{error&&<div className="error">{error}</div>}
    <section className="stats"><button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}><small>Tüm maçlar</small><strong>{counts.all}</strong></button><button className={filter==='VALUE'?'active':''} onClick={()=>setFilter('VALUE')}><small>Value</small><strong>{counts.value}</strong></button><button className={filter==='İZLE'?'active':''} onClick={()=>setFilter('İZLE')}><small>İzle</small><strong>{counts.watch}</strong></button><button className={filter==='PAS'?'active':''} onClick={()=>setFilter('PAS')}><small>Pas</small><strong>{counts.pass}</strong></button></section>
    <div className="section-title"><div><h2>Maç tarayıcı</h2><p>O gün API aboneliğinin erişebildiği tüm fikstür sayfaları çekilir.</p></div><span>{fixtures.length} maç</span></div>
    <section className="matches">{fixtures.map(item=><MatchCard key={item.fixture.id} item={item} onOpen={setOpenId}/>)}</section>
    {!data&&!error&&<div className="loading">Maçlar taranıyor…</div>}{data&&!fixtures.length&&<div className="empty">Bu filtrede maç bulunamadı.</div>}{openId&&<Detail id={openId} close={()=>setOpenId(null)}/>} 
  </main>;
}
