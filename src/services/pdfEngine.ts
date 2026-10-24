import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import QRCode from 'qrcode';
import type { CertificateData } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload } from './security';
import { PDF_ASSETS, CERTIFICATE_TEMPLATE } from './pdfAssets';

export interface PDFGenerationResult {
  pdfBytes: Uint8Array;
  qrDataUrl: string;
  verificationUrl: string;
  sha256Hash: string;
  fileName: string;
}

// Singleton browser instance for performance and stability
let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (globalBrowser && globalBrowser.connected) {
    try {
      // Check if we can actually use the browser
      await globalBrowser.pages();
      return globalBrowser;
    } catch (e) {
      console.warn('[PDF Engine] Browser connection stale, restarting...');
      globalBrowser = null;
    }
  }
  
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  console.log(`[PDF Engine] Launching Puppeteer (Production: \${isProduction})...`);
  
  try {
    const launchOptions: any = {
      args: isProduction ? [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ] : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: isProduction 
        ? await (chromium as any).executablePath() 
        : (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome'),
      headless: isProduction ? (chromium as any).headless : true,
      ignoreHTTPSErrors: true,
    };

    globalBrowser = await puppeteer.launch(launchOptions);
    return globalBrowser;
  } catch (err: any) {
    console.error('[PDF Engine] Puppeteer Launch Error:', err);
    throw new Error(`PDF Engine Init Failed: \${err.message || 'Check environment dependencies'}`);
  }
}

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { 
    errorCorrectionLevel: 'H', 
    margin: 0, 
    width: 280, 
    color: { dark: '#000000', light: '#ffffff' } 
  });
}

export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  const host = options?.hostDomain || 'https://mymf-portal.vercel.app'; // Default to production domain
  const verificationUrl = `\${host}/verify/\${encodeURIComponent(certData.cert_id.trim())}`;
  
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));
  const qrCodeUrl = await generateQRCodeDataUrl(verificationUrl);
  
  // Clean client name
  const cleanClientName = certData.client
    .replace(/^Materials of M\/S\s+/i, '')
    .replace(/^Materials of\s+/i, '')
    .replace(/^M\/S\s+/i, '')
    .trim();

  const templateData = {
    certRef: certData.cert_id,
    issueDate: certData.issue_date,
    cleanClientName,
    items: certData.line_items || [],
    qrCodeUrl
  };

  const html = CERTIFICATE_TEMPLATE(templateData);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Set a timeout
    await page.setDefaultTimeout(30000); 
    
    // Set content
    await page.setContent(html, { waitUntil: 'load' });
    
    // Wait for fonts
    await page.evaluateHandle('document.fonts.ready');
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0.2in', right: '0.2in', bottom: '0.2in', left: '0.2in' },
      preferCSSPageSize: true
    });
    
    return { 
      pdfBytes: new Uint8Array(pdfBuffer), 
      qrDataUrl: qrCodeUrl, 
      verificationUrl, 
      sha256Hash, 
      fileName: `\${certData.line_items?.[0]?.site_id || 'Unknown'}_MYMF_Cert_\${certData.cert_id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` 
    };
  } catch (err: any) {
    console.error(`[PDF Engine] CRITICAL FAILURE for \${certData.cert_id}:`, err);
    throw new Error(`PDF generation failed: \${err.message}`);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore
      }
    }
  }
}
