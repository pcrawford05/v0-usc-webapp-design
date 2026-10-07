const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: process.argv[3], format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-family:Liberation Sans,Arial;font-size:7.5pt;color:#777;padding:0 0.65in;display:flex;justify-content:space-between"><span style="color:#990000;font-weight:600">USC Entrepreneurship &amp; Innovation Directory</span><span class="pageNumber"></span></div>' });
  await b.close();
})();
