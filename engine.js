(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.ReversiEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const EMPTY=0,BLACK=1,WHITE=2,SIZE=8;
  const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const INDEX=(r,c)=>r*8+c;
  const IN=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
  const OTHER=p=>3-p;
  const WEIGHTS=[
    120,-20,20,5,5,20,-20,120,
    -20,-40,-5,-5,-5,-5,-40,-20,
    20,-5,15,3,3,15,-5,20,
    5,-5,3,3,3,3,-5,5,
    5,-5,3,3,3,3,-5,5,
    20,-5,15,3,3,15,-5,20,
    -20,-40,-5,-5,-5,-5,-40,-20,
    120,-20,20,5,5,20,-20,120
  ];
  function initial(){
    const board=Array(64).fill(0);
    board[INDEX(3,3)]=WHITE;board[INDEX(3,4)]=BLACK;
    board[INDEX(4,3)]=BLACK;board[INDEX(4,4)]=WHITE;
    return board;
  }
  function valid(board){return Array.isArray(board)&&board.length===64&&board.every(v=>Number.isInteger(v)&&v>=0&&v<=2)}
  function flips(board,player,index){
    if(!valid(board)||![1,2].includes(player)||!Number.isInteger(index)||index<0||index>=64||board[index])return [];
    const r=Math.floor(index/8),c=index%8,opp=OTHER(player),all=[];
    for(const [dr,dc] of DIRS){
      const line=[];let rr=r+dr,cc=c+dc;
      while(IN(rr,cc)&&board[INDEX(rr,cc)]===opp){line.push(INDEX(rr,cc));rr+=dr;cc+=dc;}
      if(line.length&&IN(rr,cc)&&board[INDEX(rr,cc)]===player)all.push(...line);
    }
    return all;
  }
  function legal(board,player){
    if(!valid(board)||![1,2].includes(player))return [];
    const options=[];
    for(let i=0;i<64;i++)if(!board[i]){
      const captured=flips(board,player,i);
      if(captured.length)options.push({index:i,flips:captured});
    }
    return options;
  }
  function apply(board,player,index){
    const captured=flips(board,player,index);
    if(!captured.length)return null;
    const next=board.slice();next[index]=player;
    for(const i of captured)next[i]=player;
    return next;
  }
  function score(board){
    if(!valid(board))throw Error("Invalid Reversi board");
    let black=0,white=0;
    for(const n of board){if(n===1)black++;else if(n===2)white++;}
    return {black,white,empty:64-black-white};
  }
  function nextTurn(board,justPlayed){
    const other=OTHER(justPlayed);
    if(legal(board,other).length)return {turn:other,pass:null,over:false};
    if(legal(board,justPlayed).length)return {turn:justPlayed,pass:other,over:false};
    return {turn:null,pass:null,over:true};
  }
  function evaluate(board,player){
    const other=OTHER(player),sc=score(board);
    if(sc.empty===0||(!legal(board,player).length&&!legal(board,other).length)){
      const diff=(player===BLACK?sc.black-sc.white:sc.white-sc.black);
      return diff>0?100000+diff:diff<0?-100000+diff:0;
    }
    let value=0;
    for(let i=0;i<64;i++){
      if(board[i]===player)value+=WEIGHTS[i];
      if(board[i]===other)value-=WEIGHTS[i];
    }
    const mobility=legal(board,player).length-legal(board,other).length;
    const disks=player===BLACK?sc.black-sc.white:sc.white-sc.black;
    return value+mobility*8+(sc.empty<15?disks*6:disks);
  }
  function minimax(board,turn,player,depth,alpha,beta){
    const actions=legal(board,turn);
    if(depth<=0)return evaluate(board,player);
    if(!actions.length){
      if(!legal(board,OTHER(turn)).length)return evaluate(board,player);
      return minimax(board,OTHER(turn),player,depth-1,alpha,beta);
    }
    const maximizing=turn===player;
    let best=maximizing?-Infinity:Infinity;
    const ordered=actions.map(x=>({index:x.index,weight:WEIGHTS[x.index]}))
      .sort((a,b)=>b.weight-a.weight);
    for(const item of ordered){
      const child=apply(board,turn,item.index);
      const v=minimax(child,OTHER(turn),player,depth-1,alpha,beta);
      best=maximizing?Math.max(best,v):Math.min(best,v);
      if(maximizing)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
      if(beta<=alpha)break;
    }
    return best;
  }
  function chooseMove(board,player,difficulty="medium",random=Math.random){
    const options=legal(board,player);
    if(!options.length)return null;
    if(difficulty==="easy")return options[Math.floor(Math.min(.99999999,Math.max(0,random()))*options.length)].index;
    const depth=difficulty==="hard"?4:2;
    const evaluated=options.map(x=>{
      const b=apply(board,player,x.index);
      const score=minimax(b,OTHER(player),player,depth-1,-Infinity,Infinity);
      const bonus=difficulty==="medium"?x.flips.length*.4:0;
      return {index:x.index,score:score+bonus};
    });
    const best=Math.max(...evaluated.map(x=>x.score));
    const top=evaluated.filter(x=>x.score>=best-(difficulty==="medium"?6:0));
    return top[Math.floor(Math.min(.99999999,Math.max(0,random()))*top.length)].index;
  }
  return Object.freeze({EMPTY,BLACK,WHITE,initial,valid,flips,legal,apply,score,nextTurn,chooseMove,evaluate});
});
