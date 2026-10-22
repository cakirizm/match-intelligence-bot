/* Run: node --test tests/v6-engine.test.cjs
 * No external dependencies; synthetic cases avoid pretending to verify future football data.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../v6-engine.js');
function seed(){
 const names=['Arsenal FC','Chelsea FC','Liverpool FC','Manchester City FC','Tottenham Hotspur FC','Brighton FC','Everton FC','Newcastle United FC'];
 const out=[];
 for(let i=0;i<340;i++){
  const date=new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10);
  const home=names[i%names.length],away=names[(i*5+1)%names.length];
  if(home!==away)out.push({date,home,away,hg:(i*11+2)%4,ag:(i*7+1)%3,source:'CSV'});
 }
 return out;
}
test('clean scores exclude future/same-date matches and prefer user data',()=>{
 const m={date:'2026-10-20',home:'Arsenal',away:'Chelsea',hg:2,ag:1,source:'OpenFootball'};
 const rows=[m,{...m,hg:3,source:'CSV'},{...m,date:'2026-10-22',hg:8},{...m,date:'2026-10-23',hg:7}];
 const chosen=engine.cleanMatches(rows,'2026-10-22');
 assert.equal(chosen.length,1);
 assert.equal(chosen[0].hg,3);
});
test('alias matching is consistent',()=>{
 assert.equal(engine.key('Man City'),engine.key('Manchester City FC'));
 assert.equal(engine.key('B. Dortmund'),engine.key('Borussia Dortmund'));
});
test('joint score grid sums to one and Dixon-Coles modifies low-score probability',()=>{
 const a=engine.grid(1.6,1.3,-.1),b=engine.grid(1.6,1.3,0);
 assert.ok(Math.abs(a.probs.reduce((x,y)=>x+y,0)-1)<1e-10);
 assert.notEqual(a.entries.find(r=>r.h===0&&r.a===0)?.p,b.entries.find(r=>r.h===0&&r.a===0)?.p);
 for(let i=0;i<100;i++){
  const [home,away]=engine.sample(a);assert.ok(home>=0&&home<=11&&away>=0&&away<=11);
 }
});
test('predict never reads post-cutoff scores or user xG when insufficient',()=>{
 const all=seed(),params={leagueMatches:all,allMatches:all,home:'Arsenal',away:'Chelsea',date:'2024-10-22'};
 const a=engine.predict(params);
 const b=engine.predict({...params,leagueMatches:[...all,{date:'2026-10-23',home:'Arsenal',away:'Chelsea',hg:17,ag:0}]});
 assert.equal(a.home,b.home);
 assert.equal(a.away,b.away);
 const no=engine.predict({...params,xgRows:[{date:'2024-02-01',home:'Arsenal',away:'Chelsea',homeXg:7,awayXg:0}]});
 assert.equal(no.home,a.home);
 assert.equal(no.xgUsed,false);
});
test('chronological backtest reports finite metrics and a prior-only league baseline',()=>{
 const rows=seed();
 const r=engine.backtest({leagueMatches:rows,allMatches:rows,maxGames:80});
 assert.equal(r.tested,80);
 assert.ok(Number.isFinite(r.brier)&&r.brier>=0&&r.brier<=2/3);
 assert.ok(Number.isFinite(r.baselineBrier)&&r.baselineBrier>=0);
 assert.ok(Number.isFinite(r.logLoss)&&r.logLoss>=0);
 assert.ok(r.predictions.every(x=>x.date<='2026-10-22'));
 assert.match(r.methodology,/son 140/);
});
test('bounded tactics expose manual assumptions, not tracked facts',()=>{
 assert.deepEqual([engine.tacticFactors({}).home,engine.tacticFactors({}).away],[0,0]);
 const a=engine.tacticFactors({homePress:'high',awayStyle:'counter'});
 assert.ok(Math.abs(a.home)<=.075&&Math.abs(a.away)<=.075);
});
test('insufficient historical matches do not produce fabricated validation accuracy',()=>{
 const r=engine.backtest({leagueMatches:seed().slice(0,20),maxGames:80});
 assert.ok(r.error);
});
