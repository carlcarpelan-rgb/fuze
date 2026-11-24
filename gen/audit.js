const G=require('./gen.js'); const L=require('./levels.json');
const free=[], dist={};
L.forEach((lv,i)=>{
  const rows=lv.m.split('/'),h=rows.length,w=rows[0].length;
  const g=new Uint8Array(w*h),b=new Uint8Array(w*h);let s=0;
  rows.forEach((r,y)=>[...r].forEach((c,x)=>{const k=y*w+x;if(c==='#')g[k]=1;else if(c==='B')b[k]=1;else if(c==='S')s=k;}));
  if(lv.s){ const r=G.solveScroll(w,h,lv.v,g,b,s%w,(s-s%w)/w,{m:4,push:false,cap:6000}); if(r) free.push(i+1); }
  else { const r=G.solveNormal(w,h,g,b,s,20000); dist[r.P]=(dist[r.P]||0)+1; if(r.P===0) free.push(i+1); }
});
console.log('no push needed:',free.join(','),'| min pushes -> count',JSON.stringify(dist));
