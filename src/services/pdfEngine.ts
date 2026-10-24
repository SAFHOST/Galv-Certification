import puppeteer, { Browser } from 'puppeteer';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CertificateData } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload } from './security';
import { TEMPLATE_ASSETS } from './templateAssets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  if (globalBrowser && globalBrowser.isConnected()) {
    return globalBrowser;
  }
  
  console.log('[PDF Engine] Launching new Puppeteer instance...');
  globalBrowser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });
  return globalBrowser;
}

export function buildVerificationUrl(cert: CertificateData | string, customDomain?: string): string {
  const certId = typeof cert === 'string' ? cert : cert.cert_id;
  const cleanId = encodeURIComponent(certId.trim());
  let base = customDomain?.trim().replace(/\/+$/, '') || 'http://localhost:3000';
  const targetUrl = `${base}/verify/${cleanId}`;
  if (typeof cert === 'object' && cert.client) {
    const firstItem = cert.line_items?.[0];
    const params = new URLSearchParams({
      c: cert.client,
      s: firstItem?.site_id || '',
      desc: firstItem?.description || '',
      q: String(firstItem?.quantity || 1),
      u: firstItem?.unit || '3M',
      dft: String(firstItem?.measured_dft_um || 91.5),
      d: cert.issue_date,
      p: cert.project_name || '',
      po: cert.purchase_order_no || '',
      dn: cert.delivery_note_no || '',
      h: cert.sha256_hash || '',
      v: cert.status === 'REVOKED' ? 'REVOKED' : 'PASS',
    });
    return `${targetUrl}?${params.toString()}`;
  }
  return targetUrl;
}

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'H', margin: 0, width: 280, color: { dark: '#000000', light: '#ffffff' } });
}

export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  const host = options?.hostDomain || 'http://localhost:3000';
  const verificationUrl = `${host}/verify/${encodeURIComponent(certData.cert_id.trim())}`;
  certData.verification_url = verificationUrl;
  
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 0, width: 280 });
  
  // Read template
  const logoBase64 = "data:image/png;base64," + fs.readFileSync(TEMPLATE_ASSETS.logoPath).toString("base64");
  const signatureBase64 = "data:image/jpeg;base64," + fs.readFileSync(TEMPLATE_ASSETS.signaturePath).toString("base64");
  const stampBase64 = "data:image/jpeg;base64," + fs.readFileSync(TEMPLATE_ASSETS.stampPath).toString("base64");
  let html = fs.readFileSync(path.resolve(__dirname, '../templates/certificate.html'), 'utf8');

  // Fill template
  html = html
    .replace('{{LOGO_DATA}}', logoBase64)
    .replace('{{SIGNATURE_DATA}}', signatureBase64)
    .replace('{{STAMP_DATA}}', stampBase64)
    .replace('{{QR_DATA}}', qrDataUrl)
    .replace('{{CERT_REF}}', certData.cert_id)
    .replace('{{CERT_DATE}}', certData.issue_date)
    .replace('{{CLIENT_NAME}}', certData.client);

  const tableRows = certData.line_items?.map(item => `
    <tr>
        <td class="col-item">${item.item_no}</td>
        <td class="col-site">${item.site_id}</td>
        <td class="col-desc">${item.description}</td>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-unit">${item.unit}</td>
    </tr>
  `).join('') || '';
  
  html = html.replace('{{TABLE_ROWS}}', tableRows);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Set a timeout for the entire operation
    await page.setDefaultTimeout(30000);
    
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });
    
    return { 
      pdfBytes: new Uint8Array(pdfBuffer), 
      qrDataUrl, 
      verificationUrl, 
      sha256Hash, 
      fileName: `${certData.line_items?.[0]?.site_id || 'Unknown'}_${certData.client.replace(/[^a-zA-Z0-9-_]/g, '_')}_${certData.cert_id}.pdf` 
    };
  } catch (err: any) {
    console.error(`[PDF Engine] Error generating PDF for ${certData.cert_id}:`, err);
    throw new Error(`PDF generation failed: ${err.message}`);
  } finally {
    if (page) {
      await page.close().catch(e => console.error('[PDF Engine] Error closing page:', e));
    }
  }
}

