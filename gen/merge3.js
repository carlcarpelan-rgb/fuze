const fs=require('fs'),path=require('path');process.chdir(__dirname);
const partial=process.argv[2]==='partial';
let parts=[]; for(const f of ['g3part0.json','g3part1.json']) if(fs.existsSync(f)) parts=parts.concat(JSON.parse(fs.readFileSync(f)));
const sc=require('./boss.json');
const L=[],S=[];
for(let wi=0;wi<10;wi++){
  let m=parts.filter(p=>p.wi===wi);
  if(m.length<10){ if(!partial) throw new Error('world '+(wi+1)+' has '+m.length); const pool=m.length?m:parts; m=[...m]; while(m.length<10) m.push(pool[m.length%pool.length]); }
  const intro=m.find(p=>p.intro);
  let rest=m.filter(p=>p!==intro).sort((a,b)=>a.D-b.D);
  if(intro){ rest=rest.slice(rest.length-9); rest=[intro,...rest]; } else rest=rest.slice(rest.length-10);
  while(rest.length<10){ if(!partial) throw new Error('short world '+(wi+1)); rest.push(rest[rest.length-1]||parts[0]); }
  // tight fuse: time to walk the solution plus thinking time that shrinks world by world
  for(const x of rest){ const t=Math.ceil(x.L*0.3+(4+x.P*1.6+x.gap*1.4)*(1-wi*0.03)); x.lv=Object.assign({},x.lv,{t:Math.max(15,t)}); }
  // the first levels of the game are forgiving: level 1 gets double time, easing to normal by level 10
  if(wi===0) rest.forEach((x,k)=>{ const g=k<5?k:k+1; if(g<10) x.lv.t=Math.ceil(x.lv.t*(1+(10-g)*0.11)); });
  let k=0;
  for(let li=0;li<12;li++){ if(li===5||li===11){const s=sc[wi*2+(li===11?1:0)];L.push(s.lv);S.push(s.sol);} else {L.push(rest[k].lv);S.push(rest[k].sol);k++;} }
  if(!partial) console.log('W'+(wi+1),rest.map(x=>`${x.mode[0]}P${x.P}/g${x.gap}${x.fills?'/o'+x.fills:''}${x.ices?'/i'+x.ices:''}`).join(' '));
}
fs.writeFileSync('levels.json',JSON.stringify(L));fs.writeFileSync('solutions.json',JSON.stringify(S));
console.log('wrote',L.length);
