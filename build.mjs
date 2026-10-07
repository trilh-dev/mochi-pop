// Inlines the font and game script into www/index.html (single self-contained file).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const font = readFileSync(dir + 'src/fredoka.woff2').toString('base64');
const version = parseInt(readFileSync(dir + 'VERSION', 'utf8'), 10);
const js = readFileSync(dir + 'src/game.js', 'utf8').replace('__VERSION__', String(version));
const html = readFileSync(dir + 'src/index.html', 'utf8').replace('__FONT__', font).replace('__GAME__', () => js);
mkdirSync(dir + 'www', { recursive: true });
writeFileSync(dir + 'www/index.html', html);
// Read by the Android app to find over-the-air updates. Bump minApp when a build needs a newer app.
writeFileSync(dir + 'www/version.json', JSON.stringify({ version, minApp: 1 }) + '\n');
console.log('www/index.html', html.length, 'bytes, version', version);
