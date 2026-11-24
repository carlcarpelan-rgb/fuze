const G=require('./gen.js');
// quick experiment: how long do various targets take
for (const [w,h,P,nb] of [[9,7,0,1],[9,7,1,1],[11,7,3,1],[11,9,5,2],[13,9,7,2]]) {
  const t=Date.now(); const lv=G.makeNormal(1234+P, w,h,P,nb,{iters:400,stale:140,cap:12000,maxDens:0.46,minL:w+h});
  console.log(w,h,'P',P, lv? `ok L=${lv.moves.length} expl=${lv.explored} ${lv.style}`:'FAIL', Date.now()-t,'ms');
  if(lv) console.log(G.encode(lv.w,lv.h,lv.g,lv.bomb,lv.start).split('/').join('\n'));
}
