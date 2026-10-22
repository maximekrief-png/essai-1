// Captures d'écran de contrôle : node tools/screenshot.mjs <url> <fichier.png> [largeur]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const [url, out, width = '1366', full = 'full'] = process.argv.slice(2);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full === 'full' });
await browser.close();
