(()=>{
"use strict";
const E=window.ReversiEngine;
if(!E)throw Error("Reversi engine unavailable");
const GAME_KEY="reversifunny.game.v1",SETTINGS_KEY="reversifunny.settings.v1";
const STATS_KEY="reversifunny.stats.v1";
const $=id=>document.getElementById(id);
const defaults={mode:"cpu",difficulty:"medium",showHints:true};
const MODES=["cpu","local"],LEVELS=["easy","medium","hard"];
function getStored(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
let saveOK=true,statsSaveFailed=false;
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));saveOK=true;return true}catch{saveOK=false;return false}}
function validSettings(v){
 return {mode:MODES.includes(v?.mode)?v.mode:"cpu",difficulty:LEVELS.includes(v?.difficulty)?v.difficulty:"medium",showHints:typeof v?.showHints==="boolean"?v.showHints:true};
}
let settings=validSettings(getStored(SETTINGS_KEY));
function safeCounter(n){return Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:0}
function readStats(){
 const s=getStored(STATS_KEY);
 return {
  cpu:{wins:safeCounter(s?.cpu?.wins),losses:safeCounter(s?.cpu?.losses),
   draws:safeCounter(s?.cpu?.draws)},
  local:{blackWins:safeCounter(s?.local?.blackWins),
   whiteWins:safeCounter(s?.local?.whiteWins),draws:safeCounter(s?.local?.draws)}
 };
}
let stats=readStats();
function updateStatsView(){
 $("cpuWins").textContent=String(stats.cpu.wins);
 $("cpuLosses").textContent=String(stats.cpu.losses);
 $("cpuDraws").textContent=String(stats.cpu.draws);
 $("localBlackWins").textContent=String(stats.local.blackWins);
 $("localWhiteWins").textContent=String(stats.local.whiteWins);
 $("localDraws").textContent=String(stats.local.draws);
}
function addResult(group,field){
 if(stats[group][field]>=999999999)return;
 stats[group][field]++;
 statsSaveFailed=!store(STATS_KEY,stats);
 updateStatsView();
}
function recordFinishedGame(){
 const sc=E.score(state.board);
 if(state.mode==="cpu"){
  addResult("cpu",sc.black===sc.white?"draws":sc.black>sc.white?"wins":"losses");
 }else{
  addResult("local",sc.black===sc.white?"draws":sc.black>sc.white?"blackWins":"whiteWins");
 }
}
function cleanHistory(h){
 if(!Array.isArray(h))return [];
 return h.filter(x=>E.valid(x?.board)&&[1,2].includes(x?.turn)&&typeof x.over==="boolean").slice(-120)
  .map(x=>({board:x.board,turn:x.turn,over:x.over,pass:x.pass||null}));
}
function readGame(){
 const v=getStored(GAME_KEY);
 if(!v||v.version!==1||!E.valid(v.board)||![1,2].includes(v.turn)||
   !MODES.includes(v.mode)||!LEVELS.includes(v.difficulty)||
   !Number.isFinite(v.elapsedMs)||v.elapsedMs<0||v.elapsedMs>864000000||
   typeof v.over!=="boolean")return null;
 return {version:1,board:v.board,turn:v.turn,over:v.over,paused:true,
  elapsedMs:v.elapsedMs,mode:v.mode,difficulty:v.difficulty,
  pass:v.pass===1||v.pass===2?v.pass:null,history:cleanHistory(v.history)};
}
function newState(){
 return {version:1,board:E.initial(),turn:1,paused:true,over:false,
  elapsedMs:0,mode:settings.mode,difficulty:settings.difficulty,pass:null,history:[]};
}
let state=readGame()||newState(),runStarted=null,appActive=true,aiTimer=null;
let toastTimer=null,lastSavedSecond=-1;
const cells=[];
function elapsed(){return state.elapsedMs+(runStarted===null?0:Math.max(0,Date.now()-runStarted))}
function formatted(ms){
 const secs=Math.floor(ms/1000),h=Math.floor(secs/3600),m=Math.floor(secs%3600/60),s=secs%60;
 const two=n=>String(n).padStart(2,"0");
 return h?two(h)+":"+two(m)+":"+two(s):two(m)+":"+two(s);
}
function save(){
 store(GAME_KEY,{...state,elapsedMs:elapsed()});
 const notice=$("saveNote");notice.hidden=saveOK&&!statsSaveFailed;
 if(!saveOK||statsSaveFailed)notice.textContent="⚠️ Η αποθήκευση παιχνιδιού ή στατιστικών απέτυχε. Ελευθέρωσε χώρο πριν κλείσεις την εφαρμογή.";
}
function toast(message){
 const t=$("toast");t.textContent=message;t.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,2200);
}
function stopAI(){if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null}}
function pauseGame(){
 stopAI();
 if(!state.paused&&!state.over){
  state.elapsedMs=elapsed();runStarted=null;state.paused=true;
 }
 save();render();
}
function resume(){
 if(state.over)return;
 if(!appActive||document.hidden){toast("Επίλεξε την καρτέλα Παιχνίδια για να συνεχίσεις.");return}
 if(!state.paused)return;
 state.paused=false;runStarted=Date.now();save();render();scheduleAI();
}
function makeBoard(){
 const board=$("board"),frag=document.createDocumentFragment();
 for(let i=0;i<64;i++){
  const button=document.createElement("button");
  button.type="button";button.className="square";button.dataset.index=String(i);
  button.setAttribute("role","gridcell");
  button.addEventListener("click",()=>play(i,false));
  cells.push(button);frag.appendChild(button);
 }
 board.appendChild(frag);
}
function winner(){
 const s=E.score(state.board);
 if(s.black===s.white)return "Ισοπαλία!";
 return s.black>s.white?"Νίκησαν τα μαύρα!":"Νίκησαν τα λευκά!";
}
function render(){
 const sc=E.score(state.board);
 $("timer").textContent=formatted(elapsed());
 $("score").textContent=sc.black+" / "+sc.white;
 $("turnDot").classList.toggle("white",state.turn===2);
 $("turnText").textContent=state.over?winner():state.mode==="cpu"&&state.turn===2?
  "Σειρά υπολογιστή (λευκά)":"Σειρά: "+(state.turn===1?"Μαύρα":"Λευκά");
 const overlay=$("pauseOverlay");
 overlay.hidden=!state.paused&&!state.over;
 $("pauseTitle").textContent=state.over?winner():"Σε παύση";
 $("pauseDescription").textContent=state.over?
  "Τελικό σκορ: "+sc.black+" – "+sc.white+".":"Η παρτίδα αποθηκεύτηκε. Ο χρόνος δεν μετρά.";
 $("resumeButton").textContent=state.over?"＋ Νέα παρτίδα":"▶ Συνέχεια";
 $("pauseButton").querySelector(".action-icon").textContent=state.paused||state.over?"▶":"Ⅱ";
 $("pauseLabel").textContent=state.paused||state.over?"Συνέχεια":"Παύση";
 $("pauseButton").setAttribute("aria-label",state.paused||state.over?"Συνέχεια παιχνιδιού":"Παύση παιχνιδιού");
 $("pauseButton").disabled=state.over;
 $("undoButton").disabled=state.paused||state.over||!state.history.length||
  (state.mode==="cpu"&&state.turn===2);
 const humanTurn=state.mode==="local"||state.turn===1;
 const available=state.paused||state.over||!humanTurn?[]:E.legal(state.board,state.turn);
 const legal=new Set(available.map(x=>x.index));
 for(let i=0;i<64;i++){
  const sq=cells[i],v=state.board[i];
  sq.className="square"+(settings.showHints&&legal.has(i)?" legal":"");
  sq.replaceChildren();
  if(v){
   const disc=document.createElement("span");disc.className="disc "+(v===1?"black":"white");
   disc.setAttribute("aria-hidden","true");sq.appendChild(disc);
  }
  sq.setAttribute("aria-label","Γραμμή "+(Math.floor(i/8)+1)+", στήλη "+(i%8+1)+
    (v===1?", μαύρος δίσκος":v===2?", λευκός δίσκος":legal.has(i)?", διαθέσιμη κίνηση":", κενό"));
  sq.disabled=state.paused||state.over||!humanTurn||!legal.has(i);
 }
 $("hintText").textContent=state.over?"Πάτησε «Νέα παρτίδα» για να ξαναπαίξεις.":
  state.paused?"Η παρτίδα είναι σε παύση.":
  state.mode==="cpu"&&state.turn===2?"Ο υπολογιστής σκέφτεται…":
  state.pass?"Ο αντίπαλος δεν είχε κίνηση — παίζεις ξανά.":
  settings.showHints?"Πάτησε ένα φωτεινό τετράγωνο για να παίξεις.":
  "Κλείσε έναν ή περισσότερους αντίπαλους δίσκους σε ευθεία γραμμή.";
}
function pushHistory(){
 state.history.push({board:state.board.slice(),turn:state.turn,over:state.over,pass:state.pass});
 if(state.history.length>120)state.history.shift();
}
function play(index,byAI){
 if(state.paused||state.over)return false;
 if((state.mode==="cpu"&&state.turn===2)!==byAI)return false;
 const next=E.apply(state.board,state.turn,index);
 if(!next)return false;
 pushHistory();
 state.board=next;
 const info=E.nextTurn(next,state.turn);
 state.over=info.over;state.pass=info.pass;state.turn=info.turn||state.turn;
 if(info.over){
  state.elapsedMs=elapsed();runStarted=null;state.paused=true;
  stopAI();recordFinishedGame();toast(winner());
 }else if(info.pass)toast((info.pass===1?"Τα μαύρα":"Τα λευκά")+" δεν έχουν διαθέσιμη κίνηση.");
 save();render();scheduleAI();
 return true;
}
function scheduleAI(){
 stopAI();
 if(state.paused||state.over||state.mode!=="cpu"||state.turn!==2||document.hidden||!appActive)return;
 aiTimer=setTimeout(()=>{
  aiTimer=null;
  if(state.paused||state.over||state.turn!==2||!appActive||document.hidden)return;
  const index=E.chooseMove(state.board,2,state.difficulty);
  if(index!==null)play(index,true);
 },400);
}
function undo(){
 if(state.paused||!state.history.length)return;
 stopAI();
 let previous=state.history.pop();
 if(state.mode==="cpu"){
  while(state.history.length&&previous.turn!==1)previous=state.history.pop();
 }
 state.board=previous.board;state.turn=previous.turn;state.pass=previous.pass;state.over=false;
 save();render();scheduleAI();
}
async function freshGame(){
 if(!state.over&&state.history.length>0&&!await GameDialog.confirm("Να ξεκινήσει νέα παρτίδα; Η τρέχουσα θα αντικατασταθεί."))return;
 // Replacing a started CPU match is a forfeit. Pausing never changes stats.
 // A local two-player match has no individual loser when simply discarded.
 if(!state.over&&state.mode==="cpu"&&state.history.length>0)addResult("cpu","losses");
 stopAI();state=newState();runStarted=null;save();render();
 toast("Νέα παρτίδα — πρώτα παίζουν τα μαύρα.");
}
function showSettings(){
 pauseGame();
 for(const x of document.querySelectorAll('input[name="mode"]'))x.checked=x.value===settings.mode;
 for(const x of document.querySelectorAll('input[name="difficulty"]'))x.checked=x.value===settings.difficulty;
 $("showHints").checked=settings.showHints;
 $("difficultyField").hidden=settings.mode==="local";
 $("settingsDialog").showModal();
}
function closeSettings(){if($("settingsDialog").open)$("settingsDialog").close()}
function refreshFullscreenButton(){
 const active=Boolean(document.fullscreenElement);
 const btn=$("fullscreenButton");
 btn.setAttribute("aria-pressed",String(active));
 btn.setAttribute("aria-label",active?"Έξοδος από πλήρη οθόνη":"Πλήρης οθόνη");
 $("fullscreenLabel").textContent=active?"Έξοδος από πλήρη οθόνη":"Πλήρης οθόνη";
}
async function toggleFullscreen(){
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else{
   if(typeof document.documentElement.requestFullscreen!=="function")throw Error("Unsupported");
   await document.documentElement.requestFullscreen();
  }
 }catch{
  toast("Δεν επιτρέπεται η πλήρης οθόνη εδώ. Δοκίμασε το F11.");
 }
 refreshFullscreenButton();
}
makeBoard();updateStatsView();render();save();
$("pauseButton").addEventListener("click",()=>state.paused?resume():pauseGame());
$("resumeButton").addEventListener("click",()=>state.over?freshGame():resume());
function readChosenSettings(){
 return validSettings({
  mode:document.querySelector('input[name="mode"]:checked')?.value,
  difficulty:document.querySelector('input[name="difficulty"]:checked')?.value,
  showHints:$("showHints").checked
 });
}
$("newButton").addEventListener("click",async()=>{
 settings=readChosenSettings();
 store(SETTINGS_KEY,settings);
 closeSettings();
 await freshGame();
});
$("undoButton").addEventListener("click",undo);
$("settingsButton").addEventListener("click",showSettings);
$("fullscreenButton").addEventListener("click",toggleFullscreen);
document.addEventListener("fullscreenchange",refreshFullscreenButton);
document.addEventListener("fullscreenerror",()=>toast("Η πλήρης οθόνη δεν επιτρέπεται από τον browser."));
refreshFullscreenButton();
$("closeSettings").addEventListener("click",closeSettings);
document.querySelectorAll('input[name="mode"]').forEach(el=>el.addEventListener("change",()=>{
 $("difficultyField").hidden=document.querySelector('input[name="mode"]:checked')?.value==="local";
}));
$("settingsForm").addEventListener("submit",event=>{
 event.preventDefault();
 settings=readChosenSettings();
 store(SETTINGS_KEY,settings);closeSettings();render();
 toast("Οι ρυθμίσεις αποθηκεύτηκαν για την επόμενη παρτίδα.");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden)pauseGame()});
window.addEventListener("pagehide",pauseGame);
window.addEventListener("blur",()=>{if(!$("settingsDialog").open)pauseGame()});
window.addEventListener("message",event=>{
 if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=="reversifunny:visibility")return;
 appActive=event.data.active===true;
 if(!appActive)pauseGame();
});
window.addEventListener("storage",event=>{
 if(event.key===STATS_KEY){stats=readStats();statsSaveFailed=false;updateStatsView();return}
 if(event.key!==GAME_KEY||!event.newValue)return;
 const latest=readGame();if(!latest)return;
 stopAI();runStarted=null;state=latest;render();
 toast("Η παρτίδα ενημερώθηκε από άλλη καρτέλα.");
});
setInterval(()=>{
 if(state.paused)return;
 $("timer").textContent=formatted(elapsed());
 const seconds=Math.floor(elapsed()/1000);
 if(seconds!==lastSavedSecond&&seconds%5===0){lastSavedSecond=seconds;save()}
},1000);
if("serviceWorker" in navigator)
 window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"}).catch(()=>{}),{once:true});
})();
