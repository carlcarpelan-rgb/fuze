const fs=require('fs');const G=require('./gen.js');
const L=require('./levels.json'),S=require('./solutions.json');
[[0,1],[1,1],[2,2]].forEach(([i,P])=>{
  let best=null,s=91000+i*50,got=0;
  while(got<3){const lv=G.makeNormal(s++*13+5,9,7,P,1,{iters:420,stale:150,cap:12000,maxDens:0.44,minL:16}); if(!lv)continue; got++; const q=lv.explored+lv.moves.length*3; if(!best||q>best.q){best=lv;best.q=q;}}
  L[i]={m:G.encode(best.w,best.h,best.g,best.bomb,best.start),t:Math.max(15,Math.ceil(8+best.moves.length*.5+best.P*3.5)),p:best.P}; S[i]=best.moves;
  console.log('level',i+1,'P',best.P,'L',best.moves.length);
});
let lv=null,s=555; while(!lv) lv=G.makeScroll(s++,32,7,11,{dens:0.21,curtain:0.14,holeChance:0.6,needPush:true});
L[5]={m:G.encode(lv.w,lv.h,lv.g,lv.bomb,lv.start),t:L[5].t,s:L[5].s,v:11}; S[5]=lv.moves; console.log('level 6 regenerated');
fs.writeFileSync('levels.json',JSON.stringify(L)); fs.writeFileSync('solutions.json',JSON.stringify(S));
