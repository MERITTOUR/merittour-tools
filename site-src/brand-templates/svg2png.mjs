import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const src = fs.readFileSync(new URL('../../assets/logo-merittour-horizontal.svg', import.meta.url), 'utf8');
function variant(color) {
  let s = src.replace(/width="[^"]*" height="[^"]*"/, 'width="2400" height="299.5"');
  if (/fill="#[0-9a-fA-F]{3,6}"|fill:#[0-9a-fA-F]{3,6}/.test(s)) {
    s = s.replace(/fill="#[0-9a-fA-F]{3,6}"/g, `fill="${color}"`).replace(/fill:#[0-9a-fA-F]{3,6}/g, `fill:${color}`);
  } else {
    s = s.replace('<svg ', `<svg fill="${color}" `);
  }
  return s;
}
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await br.newPage({ viewport: { width: 2600, height: 400 } });
for (const [name, color] of [['logo-navy', '#373F4A'], ['logo-white', '#FFFFFF']]) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${variant(color)}</body></html>`);
  const el = await page.$('svg');
  await el.screenshot({ omitBackground: true, path: `assets/${name}.png` });
  console.log('rendered', name);
}
await br.close();
