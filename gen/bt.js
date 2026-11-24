const B=require('./boss.js');
const o={m:2,gate:.65,gateEvery:3,behind:.18,dens:.22,pil:.25};
const t0=Date.now(); B.makeBoss(52001,30,o); console.log(B.STATS, Date.now()-t0,'ms');
