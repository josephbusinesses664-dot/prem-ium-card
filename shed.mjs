import puppeteer from 'puppeteer-core';
const OUT = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--headless=new','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
  defaultViewport: { width: 1512, height: 982, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3500));
for (const f of [0.35, 0.6]) {
  await page.evaluate((f) => window.scrollTo(0, window.innerHeight * f), f);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}-shed${String(f).replace('.','')}.png` });
}
// count petals still visible at 60% scroll
const left = await page.evaluate(() => document.querySelectorAll('canvas').length);
console.log('canvas count', left);
await browser.close();
