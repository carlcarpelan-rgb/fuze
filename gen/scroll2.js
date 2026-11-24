const fs=require('fs');const G=require('./gen.js');
const out=[];
for(let wi=0;wi<10;wi++) for(const second of [false,true]){
  const W=(second?46:34)+wi*(second?4:3);
  const o={dens:0.25+wi*0.014,curtain:(wi===0&&!second?0.14:0.22+wi*0.015),holeChance:Math.max(0.1,0.45-wi*0.05),needPush:true,cap:2500,vsym:true};
  let lv=null,s=31000+wi*100+(second?50:0),tries=0; while(!lv){lv=G.makeScroll(s++,W,7,11,o);tries++;}
  const tick=Math.round(800-wi*30-(second?20:0)), time=Math.ceil((W-11)*tick/1000+12);
  out.push({lv:{m:G.encode(lv.w,lv.h,lv.g,lv.bomb,lv.start),t:time,s:tick,v:11},sol:lv.moves});
  console.error('scroll',wi+1,second?2:1,'W',W,'seeds',tries,'pushes?',lv.moves.length);
}
fs.writeFileSync('scrolls3.json',JSON.stringify(out));
