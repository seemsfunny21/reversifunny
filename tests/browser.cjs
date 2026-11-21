'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..');
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+name);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const use=fs.statSync(file,{throwIfNoEntry:false})?.isDirectory()?path.join(file,'index.html'):file;
  if(!fs.existsSync(use)){res.writeHead(404);res.end('Missing');return}
  res.setHeader('Content-Type',mime[path.extname(use)]||'application/octet-stream');
  res.end(fs.readFileSync(use));
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(f=>fs.existsSync(f));
 assert.ok(binary,'Chromium system binary required');
 const browser=await chromium.launch({headless:true,executablePath:binary,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({
   viewport:{width:393,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   locale:'el-GR',timezoneId:'Europe/Athens',serviceWorkers:'allow'
  });
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#board button.square').count(),64);
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Restored match must start paused');
  assert.equal(await page.locator('#score').textContent(),'2 / 2');
  const hero=await page.locator('.reversi-hero-art').boundingBox();
  assert.ok(hero&&hero.height>=74&&hero.height<=115&&hero.width>=350,'Games banner aligned');
  const dims=await page.evaluate(()=>({
   scroll:document.documentElement.scrollHeight,view:document.documentElement.clientHeight
  }));
  assert.ok(dims.scroll<=dims.view+3,'No scrolling on 393x844: '+JSON.stringify(dims));
  await page.locator('#resumeButton').click();
  assert.equal(await page.locator('#pauseOverlay').isVisible(),false);
  assert.equal(await page.locator('.square.legal').count(),4,'Initial black has four moves');
  await page.locator('#board button').nth(19).click();
  await page.waitForFunction(()=>{
   const g=JSON.parse(localStorage.getItem('reversifunny.game.v1'));
   return g?.history?.length>=2&&g.turn===1;
  },null,{timeout:15000});
  const afterAI=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  assert.equal(afterAI.history.length,2,'Black and CPU white played a turn');
  await page.locator('#undoButton').click();
  const undone=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  assert.equal(undone.board.filter(x=>x>0).length,4,'Undo rolls back the full human+CPU round');
  await page.evaluate(()=>window.postMessage({type:'reversifunny:visibility',active:false},location.origin));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1'))?.paused===true);
  const pausedTime=await page.locator('#timer').textContent();
  await page.waitForTimeout(1250);
  assert.equal(await page.locator('#timer').textContent(),pausedTime,'Timer freezes on Applications switch');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#pauseOverlay').isVisible(),true,'Reload preserves paused state');
  assert.equal(await page.locator('#score').textContent(),'2 / 2','Undo was saved');
  await page.locator('#settingsButton').click();
  await page.locator('input[name="difficulty"][value="hard"]').check();
  await page.locator('input[name="mode"][value="local"]').check();
  await page.locator('.save-settings').click();
  const still=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  assert.equal(still.mode,'cpu','Settings cannot overwrite ongoing match');
  await page.locator('#settingsButton').click();
  assert.equal(await page.locator('#settingsDialog').evaluate(d=>d.open),true,
   'New Game is inside Settings');
  await page.locator('#newButton').click();
  const fresh=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  assert.equal(fresh.mode,'local');
  assert.equal(fresh.paused,true);
  await page.locator('#resumeButton').click();
  await page.locator('#board button').nth(19).click();
  assert.match(await page.locator('#turnText').textContent(),/Λευκά/,'Local player two moves next');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  await page.reload({waitUntil:'domcontentloaded'});
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('reversifunny.game.v1')));
  assert.deepEqual(restored.board,saved.board,'Local game survives restart without losing move');
  assert.equal(restored.paused,true);
  console.log('PASS Reversi mobile browser: valid moves, AI, undo full round, app-switch pause, elapsed freeze, settings, 2 players and reload');
  await context.close();
  const desktop=await browser.newContext({viewport:{width:1366,height:900},
   locale:'el-GR',timezoneId:'Europe/Athens',serviceWorkers:'allow'});
  const deskPage=await desktop.newPage();
  await deskPage.goto(url,{waitUntil:'domcontentloaded'});
  const deskBoard=await deskPage.locator('.board-wrap').boundingBox();
  const deskStatus=await deskPage.locator('.status-strip').boundingBox();
  assert.ok(deskBoard&&deskBoard.width>=730,
   'Reversi board grows to desktop size: '+JSON.stringify(deskBoard));
  assert.ok(deskStatus&&deskStatus.x>=deskBoard.x+deskBoard.width+15,
   'Desktop scoreboard and controls sit beside the board');
  assert.equal(await deskPage.locator('#board button').count(),64);
  const deskFit=await deskPage.evaluate(()=>({
   width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
   height:document.documentElement.scrollHeight,viewHeight:document.documentElement.clientHeight
  }));
  assert.ok(deskFit.width<=deskFit.viewport+2&&deskFit.height<=deskFit.viewHeight+2,
   'Desktop Reversi must fit without scrolling: '+JSON.stringify(deskFit));
  await deskPage.locator('#resumeButton').click();
  assert.equal(await deskPage.locator('.square.legal').count(),4);
  await deskPage.locator('#board button').nth(19).click();
  await deskPage.waitForFunction(()=>{
   const g=JSON.parse(localStorage.getItem('reversifunny.game.v1'));
   return g?.history?.length>=2;
  },null,{timeout:15000});
  await deskPage.setViewportSize({width:1366,height:768});
  const laptopBoard=await deskPage.locator('.board-wrap').boundingBox();
  const laptopFit=await deskPage.evaluate(()=>({
   scroll:document.documentElement.scrollHeight,
   view:document.documentElement.clientHeight,
   totalWidth:document.documentElement.scrollWidth,
   viewportWidth:document.documentElement.clientWidth
  }));
  assert.ok(laptopBoard&&laptopBoard.width>=630,
   'Laptop board must be visibly bigger than the old 480px mobile-width board: '+JSON.stringify(laptopBoard));
  assert.ok(laptopFit.scroll<=laptopFit.view+2&&laptopFit.totalWidth<=laptopFit.viewportWidth+2,
   'Desktop game must fit a 1366x768 laptop without scrolling: '+JSON.stringify(laptopFit));
  await deskPage.setViewportSize({width:1920,height:1080});
  const wideBoard=await deskPage.locator('.board-wrap').boundingBox();
  assert.ok(wideBoard&&wideBoard.width>=940,
   'Full HD 1920×1080 board should be about 960px: '+JSON.stringify(wideBoard));
  const fullscreenButton=deskPage.locator('#fullscreenButton');
  assert.equal(await fullscreenButton.isVisible(),true,'Full screen button is visible on desktop');
  assert.equal(await fullscreenButton.getAttribute('aria-pressed'),'false');
  await fullscreenButton.click();
  await deskPage.waitForFunction(()=>Boolean(document.fullscreenElement),null,{timeout:7000});
  const fullBoard=await deskPage.locator('.board-wrap').boundingBox();
  assert.ok(fullBoard&&fullBoard.width>=980,
   'Native fullscreen board should be about 1000px: '+JSON.stringify(fullBoard));
  assert.equal(await deskPage.locator('.hero').isVisible(),false,
   'Fullscreen removes the decorative banner to free up space');
  assert.equal(await fullscreenButton.getAttribute('aria-pressed'),'true');
  assert.match(await deskPage.locator('#fullscreenLabel').textContent(),/Έξοδος/);
  const fullscreenFit=await deskPage.evaluate(()=>({
    width:document.documentElement.scrollWidth,viewWidth:document.documentElement.clientWidth,
    height:document.documentElement.scrollHeight,viewHeight:document.documentElement.clientHeight
  }));
  assert.ok(fullscreenFit.width<=fullscreenFit.viewWidth+2&&fullscreenFit.height<=fullscreenFit.viewHeight+2,
   'True fullscreen stays within screen without scrolling: '+JSON.stringify(fullscreenFit));
  await fullscreenButton.click();
  await deskPage.waitForFunction(()=>!document.fullscreenElement,null,{timeout:7000});
  assert.equal(await fullscreenButton.getAttribute('aria-pressed'),'false');
  console.log('FULL HD BOARD SIZES '+JSON.stringify({
    desktop:Math.round(wideBoard.width),
    fullscreen:Math.round(fullBoard.width)
  }));
  console.log('BOARD SIZES '+JSON.stringify({
   desktop:Math.round(deskBoard.width),
   laptop:Math.round(laptopBoard.width),
   wide:Math.round(wideBoard.width)
  }));
  await desktop.close();
  console.log('PASS Reversi desktop Chromium: expanded board, side score/controls, no overflow, CPU gameplay');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error('FAIL Reversi browser:',e.stack||e);process.exitCode=1});
