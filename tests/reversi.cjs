'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../engine.js');
const root=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const html=root('index.html'),app=root('app.js'),sw=root('sw.js');
new vm.Script(app,{filename:'app.js'});
new vm.Script(sw,{filename:'sw.js'});
const first=E.initial();
assert.equal(first.length,64);
assert.deepEqual(E.score(first),{black:2,white:2,empty:60});
assert.deepEqual(E.legal(first,1).map(x=>x.index),[19,26,37,44]);
assert.equal(E.legal(first,2).length,4);
assert.equal(E.apply(first,1,0),null);
const second=E.apply(first,1,19);
assert.deepEqual(E.score(second),{black:4,white:1,empty:59});
assert.deepEqual(E.score(first),{black:2,white:2,empty:60},'No mutation of input board');
assert.equal(E.nextTurn(second,1).turn,2);
for(const difficulty of ['easy','medium','hard']){
 const pick=E.chooseMove(first,1,difficulty,()=>0.41);
 assert.ok(E.legal(first,1).some(x=>x.index===pick),'AI chooses legal move: '+difficulty);
}
let passes=0;
for(let run=0;run<30;run++){
 let board=E.initial(),player=1,turns=0;
 while(turns<64){
   const options=E.legal(board,player);
   assert.ok(options.length>0,'Current player has a legal move');
   const idx=options[(run*11+turns*7)%options.length].index;
   const before=E.score(board),after=E.apply(board,player,idx);
   assert.ok(after&&E.valid(after));
   assert.equal(E.score(after).empty,before.empty-1,'Every move adds exactly one disc');
   const info=E.nextTurn(after,player);
   if(info.pass)passes++;
   board=after;turns++;
   if(info.over){assert.equal(E.legal(board,1).length,0);assert.equal(E.legal(board,2).length,0);break;}
   player=info.turn;
 }
 assert.ok(turns<=60,'At most sixty non-initial moves');
 const score=E.score(board);assert.equal(score.black+score.white+score.empty,64);
}
assert.ok(passes>=1,'Simulated matches exercise the forced pass rule');
assert.ok(html.includes('id="board"')&&html.includes('id="pauseOverlay"'));
assert.ok(html.includes('id="cpuWins"')&&html.includes('id="cpuLosses"')&&html.includes('id="localBlackWins"'),'Separate CPU and local player statistics');
assert.ok(app.includes('reversifunny.stats.v1')&&app.includes('recordFinishedGame()')&&app.includes('addResult("cpu","losses")'),'Terminal results and CPU forfeits recorded');
assert.ok(app.includes('reversifunny:visibility')&&app.includes('pagehide')&&app.includes('visibilitychange'));
assert.ok(app.includes('reversifunny.game.v1')&&app.includes('localStorage.setItem'));
assert.ok(html.includes('app.js?v=3')&&sw.includes('app.js?v=3'));
assert.ok(html.includes('style.css?v=5')&&sw.includes('style.css?v=5'));
assert.ok(root('style.css').includes('@media (min-width:960px)'),'Desktop layout must not alter mobile');
assert.ok(html.includes('id="fullscreenButton"')&&app.includes('requestFullscreen'),'Native fullscreen button must be wired');
assert.ok(root('style.css').includes('html:fullscreen .hero{display:none}'),'Full screen hides banner');
assert.ok(root('style.css').includes('960px,calc(100dvh - 100px)'),'Full HD board must expand beyond old 760px limit');
assert.ok(sw.includes('reversifunny-shell-'));
console.log('PASS Reversi rules, 30 games, forced passes, 3 AI levels, persisted paused game and isolated offline PWA');
