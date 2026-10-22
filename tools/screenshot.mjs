// Captures d'écran de contrôle : node tools/screenshot.mjs <url> <fichier.png> [largeur]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const [url, out, width = '1366', full = 'full'] = process.argv.slice(2);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
// Fait défiler pour déclencher le chargement différé des images
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === 'full' });
await browser.close();
