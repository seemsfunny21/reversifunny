'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const p=path.resolve(root,'.'+name);
  if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const file=fs.statSync(p,{throwIfNoEntry:false})?.isDirectory()?path.join(p,'index.html'):p;
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert.ok(executablePath,'Chromium required');
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:844},isMobile:true,hasTouch:true,locale:'el-GR',serviceWorkers:'allow'});
  const base='http://127.0.0.1:'+server.address().port+'/';
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.stats.v1')||'null'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#settingsButton').click();
  assert.equal(await page.locator('#cpuWins').textContent(),'0');
  assert.equal(await page.locator('#cpuLosses').textContent(),'0');
  assert.equal(await page.locator('#localBlackWins').textContent(),'0');
  await page.locator('#closeSettings').click();
  await page.locator('#resumeButton').click();
  await page.locator('#pauseButton').click();
  assert.equal(await read(),null,'Pause must not create a loss');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await read(),null,'Reloading cannot create a result');
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(19).click();
  await page.waitForFunction(()=>{
   const g=JSON.parse(localStorage.getItem('reversifunny.game.v1'));
   return g?.history?.length>=2&&g.turn===1;
  },null,{timeout:15000});
  await page.locator('#settingsButton').click();
  await page.locator('#newButton').click();
  await page.locator('#gameDialogCover .game-dialog-btn.primary').click();
  let stats=await read();
  assert.equal(stats.cpu.losses,1,'Confirmed replacement of a started CPU game is a forfeit');
  assert.equal(stats.cpu.wins,0);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal((await read()).cpu.losses,1,'Reloading cannot recount forfeit');
  await page.locator('#settingsButton').click();
  await page.locator('#newButton').click();
  assert.equal((await read()).cpu.losses,1,'Replacing untouched game cannot count loss');

  // Synthetic legal single-move terminal board: black wins a CPU match.
  await page.addInitScript(()=>{
   if(localStorage.getItem('__reversi_stats_win_seed')==='1')return;
   const key='reversifunny.game.v1',g=JSON.parse(localStorage.getItem(key)||'null');
   if(!g)return;
   g.board=Array(64).fill(1);g.board[0]=0;g.board[1]=2;
   g.turn=1;g.mode='cpu';g.paused=true;g.over=false;g.history=[];g.pass=null;
   localStorage.setItem(key,JSON.stringify(g));
   localStorage.setItem('__reversi_stats_win_seed','1');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(0).click();
  stats=await read();
  assert.equal(stats.cpu.wins,1,'Black victory against CPU recorded');
  assert.equal(stats.cpu.losses,1);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal((await read()).cpu.wins,1,'Completed game cannot double-count');

  // Local matches are grouped by winning disc color, not CPU statistics.
  await page.addInitScript(()=>{
   if(localStorage.getItem('__reversi_stats_local_black_seed')==='1')return;
   const key='reversifunny.game.v1',g=JSON.parse(localStorage.getItem(key)||'null');
   if(!g)return;
   g.board=Array(64).fill(1);g.board[0]=0;g.board[1]=2;
   g.turn=1;g.mode='local';g.paused=true;g.over=false;g.history=[];g.pass=null;
   localStorage.setItem(key,JSON.stringify(g));
   localStorage.setItem('__reversi_stats_local_black_seed','1');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(0).click();
  assert.equal((await read()).local.blackWins,1,'Local black win recorded');

  await page.addInitScript(()=>{
   if(localStorage.getItem('__reversi_stats_local_white_seed')==='1')return;
   const key='reversifunny.game.v1',g=JSON.parse(localStorage.getItem(key)||'null');
   if(!g)return;
   g.board=Array(64).fill(2);g.board[0]=0;g.board[1]=1;
   g.turn=2;g.mode='local';g.paused=true;g.over=false;g.history=[];g.pass=null;
   localStorage.setItem(key,JSON.stringify(g));
   localStorage.setItem('__reversi_stats_local_white_seed','1');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(0).click();
  assert.equal((await read()).local.whiteWins,1,'Local white win recorded');

  // After the final move, black 32 - white 32 is a draw.
  await page.addInitScript(()=>{
   if(localStorage.getItem('__reversi_stats_draw_seed')==='1')return;
   const key='reversifunny.game.v1',g=JSON.parse(localStorage.getItem(key)||'null');
   if(!g)return;
   g.board=Array(64).fill(2);g.board[0]=0;g.board[2]=1;
   for(let i=3;i<=31;i++)g.board[i]=1;
   g.turn=1;g.mode='cpu';g.paused=true;g.over=false;g.history=[];g.pass=null;
   localStorage.setItem(key,JSON.stringify(g));
   localStorage.setItem('__reversi_stats_draw_seed','1');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(0).click();
  stats=await read();
  assert.equal(stats.cpu.draws,1,'Draw tracked separately from CPU win/loss');
  assert.equal(stats.cpu.wins,1);
  assert.equal(stats.cpu.losses,1);
  assert.equal(stats.local.blackWins,1);
  assert.equal(stats.local.whiteWins,1);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.deepEqual(await read(),stats,'All statistics survive reload without duplicate');
  await page.locator('#settingsButton').click();
  assert.equal(await page.locator('#cpuWins').textContent(),'1');
  assert.equal(await page.locator('#cpuLosses').textContent(),'1');
  assert.equal(await page.locator('#cpuDraws').textContent(),'1');
  assert.equal(await page.locator('#localBlackWins').textContent(),'1');
  assert.equal(await page.locator('#localWhiteWins').textContent(),'1');
  assert.equal(await page.locator('#localDraws').textContent(),'0');
  console.log('PASS Reversi statistics: CPU win/loss/draw, local black/white, pause and reload safety, exact-once persistence');
  await page.context().close();
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error('FAIL Reversi statistics:',e.stack||e);process.exitCode=1});
