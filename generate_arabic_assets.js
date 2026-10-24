import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateImages() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const fontPath = path.resolve('public/assets/template/Cairo.ttf');
  const fontBase64 = fs.readFileSync(fontPath).toString('base64');
  
  const commonStyle = `
    <style>
      @font-face {
        font-family: 'Cairo';
        src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
      }
      body { margin: 0; padding: 10px; background: transparent; display: inline-block; font-family: 'Cairo', sans-serif; }
    </style>
  `;

  // Header Image
  await page.setContent(`
    ${commonStyle}
    <style>
      .arabic-header {
        font-size: 24px;
        color: #000;
        text-align: right;
        direction: rtl;
        line-height: 1.2;
      }
    </style>
    <div id="target" class="arabic-header">
      <strong>مصنع محمد يحيى العسيري</strong><br>
      للصناعات المعدنية<br>
      س.ت: 1010997047<br>
      الرقم الضريبي: 302154658900006
    </div>
  `, { waitUntil: 'load' });
  
  const headerElement = await page.$('#target');
  const headerBase64 = await headerElement.screenshot({ encoding: 'base64', omitBackground: true });
  
  // Footer Image
  await page.setContent(`
    ${commonStyle}
    <style>
      .arabic-footer {
        font-size: 20px;
        color: #555;
        text-align: center;
        direction: rtl;
      }
    </style>
    <div id="target" class="arabic-footer">
      المملكة العربية السعودية | ص.ب 370372، الرياض 11325
    </div>
  `, { waitUntil: 'load' });
  
  const footerElement = await page.$('#target');
  const footerBase64 = await footerElement.screenshot({ encoding: 'base64', omitBackground: true });
  
  fs.writeFileSync('arabic_assets.json', JSON.stringify({
    header: `data:image/png;base64,${headerBase64}`,
    footer: `data:image/png;base64,${footerBase64}`
  }));
  
  await browser.close();
  console.log('Arabic assets generated successfully');
}

generateImages().catch(console.error);
