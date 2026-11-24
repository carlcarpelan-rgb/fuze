// Builds the game into one self-contained HTML file.
//   node build.js              -> dist/index.html            (any website, no SDK)
//   node build.js crazygames   -> dist/crazygames/index.html (loads the CrazyGames SDK)
const fs = require('fs'), p = require('path');
const target = process.argv[2] || 'web';
const rd = f => fs.readFileSync(p.join(__dirname, f), 'utf8');
const b64 = f => fs.readFileSync(p.join(__dirname, f)).toString('base64');

const levels = rd('gen/levels.json');
const js = [rd('src/rules.js'), "(() => {\n'use strict';\nconst LEVELS = " + levels + ";",
  rd('src/art.js'), rd('src/game.js'), rd('src/platform.js'), rd('src/music.js'), rd('src/ui.js'), '})();'].join('\n');
if (js.includes('</script')) throw new Error('script close in js');

// fonts are embedded, so the game makes no requests to other servers
const face = (family, weight, file) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64('src/fonts/' + file)}) format('woff2');}`;
const fonts = '<style>' + [
  face('Saira Stencil One', 400, 'saira-stencil-one-latin-400-normal.woff2'),
  face('Barlow Semi Condensed', 500, 'barlow-semi-condensed-latin-500-normal.woff2'),
  face('Barlow Semi Condensed', 600, 'barlow-semi-condensed-latin-600-normal.woff2'),
  face('Barlow Semi Condensed', 700, 'barlow-semi-condensed-latin-700-normal.woff2')
].join('\n') + '</style>';

let html = rd('src/template.html');
html = html.replace(/<link rel="preconnect"[^>]*>\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, () => fonts);
if (html.includes('fonts.googleapis')) throw new Error('font link not replaced');
if (target === 'crazygames') html = html.replace('</title>', () => '</title>\n<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>');
html = html.replace('/*__SCRIPT__*/', () => js);

const out = target === 'crazygames' ? 'dist/crazygames/index.html' : 'dist/index.html';
fs.mkdirSync(p.dirname(p.join(__dirname, out)), { recursive: true });
fs.writeFileSync(p.join(__dirname, out), html);
console.log('built', out, (fs.statSync(p.join(__dirname, out)).size / 1024).toFixed(0) + ' kB');
