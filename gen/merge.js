const fs=require('fs');
let parts=[]; for(const f of ['part0','part1','part3','part4','part5','pool0','pool1']) if(fs.existsSync(f+'.json')) parts=parts.concat(JSON.parse(fs.readFileSync(f+'.json')));
const sc=require('./scrolls.json');
const big=parts.filter(p=>p.wi<0||p.wi>=4).sort((a,b)=>a.D-b.D);
const bigUse=big.slice(big.length-60);
const L=[],S=[];
for(let wi=0;wi<10;wi++){
  const m= wi<4 ? parts.filter(p=>p.wi===wi).sort((a,b)=>a.D-b.D).slice(0,10) : bigUse.slice((wi-4)*10,(wi-4)*10+10);
  if(m.length!==10) throw new Error('world '+wi+' has '+m.length);
  let k=0;
  for(let li=0;li<12;li++){ if(li===5||li===11){const s=sc[wi*2+(li===11?1:0)];L.push(s.lv);S.push(s.sol);} else {L.push(m[k].lv);S.push(m[k].sol);k++;} }
  console.log('W'+(wi+1),m.map(x=>`P${x.P}/g${x.gap}/L${x.L}`).join(' '));
}
fs.writeFileSync('levels.json',JSON.stringify(L));fs.writeFileSync('solutions.json',JSON.stringify(S));
