// node scripts/read-page.cjs <url>  (research runs: reads JS-rendered and bot-protected pages with the preinstalled Chromium)  -> prints the rendered page text (first 12k chars)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
 try { await p.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.waitForTimeout(4000); console.log((await p.innerText('body')).replace(/\s+/g,' ').slice(0,12000)) } catch (e) { console.log('ERROR', e.message) }
 await b.close() })();
