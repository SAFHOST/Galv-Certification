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
  try {
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
        '--single-process',
        '--disable-extensions',
        '--font-render-hinting=none'
      ]
    });
    return globalBrowser;
  } catch (err) {
    console.error('[PDF Engine] Failed to launch Puppeteer:', err);
    throw new Error('PDF Engine failed to initialize. Please try again.');
  }
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
  const logoPath = TEMPLATE_ASSETS.logoPath;
  const signaturePath = TEMPLATE_ASSETS.signaturePath;
  const stampPath = TEMPLATE_ASSETS.stampPath;
  const templatePath = path.resolve(__dirname, '../templates/certificate.html');

  if (!fs.existsSync(logoPath)) throw new Error(`Logo file not found at ${logoPath}`);
  if (!fs.existsSync(signaturePath)) throw new Error(`Signature file not found at ${signaturePath}`);
  if (!fs.existsSync(stampPath)) throw new Error(`Stamp file not found at ${stampPath}`);
  if (!fs.existsSync(templatePath)) throw new Error(`Template file not found at ${templatePath}`);

  const logoBase64 = "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64");
  const signatureBase64 = "data:image/jpeg;base64," + fs.readFileSync(signaturePath).toString("base64");
  const stampBase64 = "data:image/jpeg;base64," + fs.readFileSync(stampPath).toString("base64");
  let html = fs.readFileSync(templatePath, 'utf8');

  // Fill template - Improved cleaning of client name to prevent duplication
  const cleanClient = certData.client
    .replace(/^Materials of M\/S\s+/i, '')
    .replace(/^Materials of\s+/i, '')
    .replace(/^M\/S\s+/i, '')
    .trim();
  
  html = html
    .replace('{{LOGO_DATA}}', logoBase64)
    .replace('{{SIGNATURE_DATA}}', signatureBase64)
    .replace('{{STAMP_DATA}}', stampBase64)
    .replace('{{QR_DATA}}', qrDataUrl)
    .replace('{{CERT_REF}}', certData.cert_id)
    .replace('{{CERT_DATE}}', certData.issue_date)
    .replace('{{CLIENT_NAME}}', cleanClient);

  const tableRows = (certData.line_items || []).map(item => `
    <tr>
        <td class="col-item">${item.item_no}</td>
        <td class="col-site">${item.site_id}</td>
        <td class="col-desc">${item.description}</td>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-unit">${item.unit}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center">No items listed</td></tr>';
  
  html = html.replace('{{TABLE_ROWS}}', tableRows);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Set a timeout for the entire operation
    await page.setDefaultTimeout(60000); 
    
    // Set content and wait for fonts to load properly
    await page.setContent(html, { waitUntil: 'networkidle2' });
    
    // Force font loading check
    await page.evaluateHandle('document.fonts.ready');
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      preferCSSPageSize: true
    });
    
    return { 
      pdfBytes: new Uint8Array(pdfBuffer), 
      qrDataUrl, 
      verificationUrl, 
      sha256Hash, 
      fileName: `${certData.line_items?.[0]?.site_id || 'Unknown'}_MYMF_Cert_${certData.cert_id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` 
    };
  } catch (err: any) {
    console.error(`[PDF Engine] CRITICAL FAILURE for ${certData.cert_id}:`, err);
    throw new Error(`PDF generation failed: ${err.message}`);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error('[PDF Engine] Error closing page (swallowed):', e);
      }
    }
  }
}

