'use strict';
const R=require('../src/rules.js'); const levels=require('./levels.json'), sols=require('./solutions.json');
const D={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
let ok=0, sym={lr:0,rot:0,quad:0,ud:0,none:0};
levels.forEach((lv,i)=>{
  const st=R.makeState(R.parseLevel(lv)); let won=false, pushes=0;
  for(const c of sols[i]){
    if(won) throw new Error('moves after win '+(i+1));
    if(c==='T'){const r=R.tick(st); if(r.dead) throw new Error('dead '+(i+1)); if(r.win) won=true; continue;}
    const r=R.tryMove(st,...D[c]); if(r.t==='blocked') throw new Error('blocked in '+(i+1)); if(r.t==='push') pushes++; if(r.t==='win') won=true;
  }
  if(!won) throw new Error('not won '+(i+1));
  if(lv.p!=null && pushes!==lv.p) throw new Error('par mismatch '+(i+1)+' '+pushes+' vs '+lv.p);
  // symmetry of the block layout (ignoring S and B)
  const rows=lv.m.replace(/[SB]/g,'.').split('/'), h=rows.length, w=rows[0].length;
  const at=(x,y)=>rows[y][x]; let lr=true,ud=true,rot=true;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(at(x,y)!==at(w-1-x,y))lr=false; if(at(x,y)!==at(x,h-1-y))ud=false; if(at(x,y)!==at(w-1-x,h-1-y))rot=false; }
  sym[lr&&ud?'quad':lr?'lr':rot?'rot':ud?'ud':'none']++;
  ok++;
});
console.log('verified',ok,'of',levels.length,'symmetry',JSON.stringify(sym));
