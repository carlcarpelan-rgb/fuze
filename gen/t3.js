const G3=require('./gen3.js'), R=require('../src/rules.js');
const D={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
function replay(m,sol){const st=R.makeState(R.parseLevel({m,t:99}));let won=false;for(const c of sol){const r=R.tryMove(st,...D[c]);if(r.t==='blocked')return 'BLOCKED';if(r.t==='win')won=true;}return won?'ok':'NOT WON';}
const cases=[['plain',9,7,{nb:1,P:5,gap:2}],['pillars',11,7,{pillars:1,nb:1,P:6,gap:2,mode:'lr'}],['holes',11,9,{pillars:1,holes:1,nb:1,P:6,gap:2,needHole:1}],['ice',13,9,{pillars:1,holes:1,ice:1,nb:2,P:9,gap:4,needIce:1}]];
for(const [name,w,h,o0] of cases){
  const o=Object.assign({Pmax:o0.P+4,gapMax:o0.gap+4,Pfloor:Math.max(2,o0.P-2),gapFloor:Math.max(0,o0.gap-2),dens:.28,maxDens:.48,maxHoles:4,maxIce:6,cap:6000,iters:500,stale:170,minL:(w+h)*1.1},o0);
  const t=Date.now(); let lv=null,s=1; while(!lv&&s<40) lv=G3.build(1000+s++*7919,w,h,o);
  if(!lv){console.log(name,'FAIL');continue;}
  const m=G3.encode(w,h,lv.g,lv.bomb,lv.start);
  console.log(name,lv.mode,'P',lv.P,'gap',lv.gap,'L',lv.moves.length,'fills',lv.fills,'ices',lv.ices,'seeds',s-1,(Date.now()-t)+'ms','replay:',replay(m,lv.moves));
  console.log(m.split('/').join('\n'));
}
