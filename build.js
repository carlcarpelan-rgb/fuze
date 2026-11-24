const fs=require('fs'),p=require('path');
const rd=f=>fs.readFileSync(p.join(__dirname,f),'utf8');
const L=JSON.parse(rd('gen/levels.json')); 
const levels=JSON.stringify(L);
const js=[rd('src/rules.js'),"(() => {\n'use strict';\nconst LEVELS = "+levels+";",rd('src/art.js'),rd('src/game.js'),rd('src/ui.js'),'})();'].join('\n');
if(js.includes('</script')) throw new Error('script close in js');
fs.mkdirSync(p.join(__dirname,'dist'),{recursive:true});
fs.writeFileSync(p.join(__dirname,'dist/index.html'),rd('src/template.html').replace('/*__SCRIPT__*/',()=>js));
console.log('built',(fs.statSync(p.join(__dirname,'dist/index.html')).size/1024).toFixed(0)+' kB');
