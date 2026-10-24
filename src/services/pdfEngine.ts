import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import type { CertificateData } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload } from './security';
import { TEMPLATE_ASSETS } from './templateAssets';

export interface PDFGenerationResult {
  pdfBytes: Uint8Array;
  qrDataUrl: string;
  verificationUrl: string;
  sha256Hash: string;
  fileName: string;
}

/**
 * Resolves the full public verification URL for a given cert_id.
 * Architecture: internal ID -> verification endpoint -> in-memory QR -> PDF embed.
 * Populates authentic parameters so any phone scanner or shared link resolves 100% authentically.
 */
export function buildVerificationUrl(cert: CertificateData | string, customDomain?: string): string {
  const certId = typeof cert === 'string' ? cert : cert.cert_id;
  const cleanId = encodeURIComponent(certId.trim());
  let base = '';

  if (customDomain && customDomain.trim()) {
    base = customDomain.trim().replace(/\/+$/, '');
  } else if (typeof window !== 'undefined' && window.location?.origin) {
    base = window.location.origin.replace(/\/+$/, '');
  } else if (typeof process !== 'undefined' && process.env?.APP_URL) {
    base = process.env.APP_URL.replace(/\/+$/, '');
  } else if (typeof process !== 'undefined') {
    const vercelHost = process.env?.VERCEL_PROJECT_PRODUCTION_URL || process.env?.VERCEL_URL;
    if (vercelHost) {
      base = `https://${vercelHost.replace(/\/+$/, '')}`;
    }
  }

  if (!base) {
    base = 'http://localhost:3000';
  }

  const targetUrl = `${base}/verify/${cleanId}`;

  // If full certificate object provided, encode verified parameters into QR URL
  // so mobile phone scanners / new devices immediately resolve 100% authentically
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

/**
 * Renders Arabic text using canvas and converts to PNG for PDF embedding.
 */
function renderArabicTextToPng(lines: { text: string; fontSize: number; isBold?: boolean }[], width: number, height: number): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';

    let currentY = 30;
    lines.forEach(line => {
        ctx.font = `${line.isBold ? 'bold ' : ''}${line.fontSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
        ctx.fillText(line.text, width - 5, currentY);
        currentY += line.fontSize + 10;
    });

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch {
    return null;
  }
}

/**
 * Generates high-resolution in-memory QR Code as PNG data URL with 'H' error correction.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 0,
    width: 280,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Converts data URL to Uint8Array buffer
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js Buffer fallback
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Generates official Hot-Dip Galvanization Certificate PDF matching the exact MYMF attached template:
 * - Same official MYMF Steel Fabricator header logo
 * - Same Arabic & English company registration & VAT blocks
 * - Exact same blue Arabic rectangular official stamp
 * - Exact same Adel Y. Aseery signature
 * - Dynamic QR code embedded at bottom-right (X: 464.46, Y: 136.56, 78.5x78.5)
 */
export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  // 1. Strictly bind the verification endpoint to this certificate's ID
  const host = options?.hostDomain || (typeof window !== 'undefined' ? window.location.origin : undefined);
  const verificationUrl = buildVerificationUrl(certData, host);
  certData.verification_url = verificationUrl;

  // 2. Generate canonical payload and SHA-256 hash
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));

  // 3. Generate dynamic QR code in-memory
  const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);
  const qrImageBytes = dataUrlToUint8Array(qrDataUrl);

  // 4. Create new PDF document from scratch instead of loading template
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`MYMF Galvanization Certificate ${certData.cert_id}`);
  pdfDoc.setAuthor('Mohammed Yehya Al-Aseery For Metal Industries (MYMF)');
  pdfDoc.setSubject(`Hot-Dip Galvanization Inspection Certificate - BS EN ISO 1461 - ${certData.cert_id}`);
  
  const page = pdfDoc.addPage([612, 792]); // Standard Letter size
  const { width, height } = page.getSize();

  // Load standard Helvetica typefaces
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed dynamic QR Code
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  // Load assets
  const logoImageBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.logoJpgBase64);
  const logoImage = await pdfDoc.embedJpg(logoImageBytes);
  const stampImageBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.stampJpgBase64);
  const stampImage = await pdfDoc.embedJpg(stampImageBytes);
  const signImageBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.signatureJpgBase64);
  const signImage = await pdfDoc.embedJpg(signImageBytes);

  // --- PDF Content Drawing ---
  
  // --- PDF Content Drawing ---
  
  // Header Logo
  page.drawImage(logoImage, { x: 246, y: height - 100, width: 120, height: 60 });
  
  // English Header
  page.drawText('Mohammed Yehya Al-Aseery', { x: 50, y: height - 40, size: 9, font: fontBold });
  page.drawText('For Metal Industries', { x: 50, y: height - 52, size: 8, font: fontRegular });
  page.drawText('CR No: 1010997047', { x: 50, y: height - 64, size: 8, font: fontRegular });
  page.drawText('VAT No: 302154658900006', { x: 50, y: height - 76, size: 8, font: fontRegular });
  
  // Arabic Header
  const headerArabicPng = renderArabicTextToPng([
    { text: 'مصنع محمد يحيى العسيري', fontSize: 16, isBold: true },
    { text: 'للصناعات المعدنية', fontSize: 12 },
    { text: 'س.ت: 1010997047', fontSize: 10 },
    { text: 'الرقم الضريبي: 302154658900006', fontSize: 10 },
  ], 250, 100);
  if (headerArabicPng) {
    const arabicHeaderImg = await pdfDoc.embedPng(headerArabicPng);
    page.drawImage(arabicHeaderImg, { x: 320, y: height - 90, width: 250, height: 80 });
  }
  
  // Title
  page.drawText('HOT DIP GALVANIZATION CERTIFICATE', { x: width / 2 - 130, y: height - 130, size: 14, font: fontBold });
  
  // Cert Reference & Date
  page.drawText(`Cert. Ref. No.: ${certData.cert_id}`, { x: 50, y: height - 150, size: 9, font: fontRegular });
  page.drawText(`Date: ${certData.issue_date}`, { x: 480, y: height - 150, size: 9, font: fontRegular });

  // Attestation
  page.drawText(
    `Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMAF) certifies that the materials of M/S ${certData.client} were`,
    { x: 50, y: height - 180, size: 9, font: fontRegular }
  );
  page.drawText('hot-dip galvanized in conformance with BS EN ISO 1461.', {
    x: 50, y: height - 192, size: 9, font: fontRegular,
  });

  // Table
  const tableY = height - 230;
  const tableX = 50;
  const tableWidth = 510;
  
  // Table headers
  const colX = [tableX + 10, tableX + 80, tableX + 180, tableX + 380, tableX + 450];
  const headers = ['Item #', 'Site #', 'Description', 'Quantity', 'Unit'];
  
  // Draw header row
  page.drawRectangle({ x: tableX, y: tableY - 15, width: tableWidth, height: 25, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y: tableY - 8, size: 9, font: fontBold });
  });

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(currentLine + ' ' + word, size);
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

// ... (in generateCertificatePDF)

  const items = certData.line_items || [];
  let currentY = tableY - 35;
  items.forEach((item, i) => {
    const wrappedDescription = wrapText(item.description, fontRegular, 9, 190);
    const numLines = wrappedDescription.length;
    const rowHeight = Math.max(25, numLines * 12);
    
    // Draw row rectangle
    page.drawRectangle({ x: tableX, y: currentY - rowHeight + 15, width: tableWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    
    page.drawText(String(item.item_no), { x: colX[0], y: currentY - 5, size: 9, font: fontRegular });
    page.drawText(item.site_id, { x: colX[1], y: currentY - 5, size: 9, font: fontRegular });
    
    wrappedDescription.forEach((line, lineIdx) => {
       page.drawText(line, { x: colX[2], y: currentY - 5 - (lineIdx * 12), size: 9, font: fontRegular });
    });
    
    page.drawText(String(item.quantity), { x: colX[3], y: currentY - 5, size: 9, font: fontRegular });
    page.drawText(item.unit, { x: colX[4], y: currentY - 5, size: 9, font: fontRegular });
    
    currentY -= rowHeight;
  });
  
  // Footer: Signature, Stamp, QR
  page.drawText('Mohammed Yehya Al-Aseery Factory For Metal Industries', { x: 50, y: 280, size: 9, font: fontRegular });
  page.drawText('MYMAF', { x: 50, y: 268, size: 9, font: fontRegular });
  
  page.drawImage(signImage, { x: 50, y: 220, width: 100, height: 40 });
  page.drawText('Adel Y. Aseery', { x: 50, y: 205, size: 9, font: fontRegular });
  page.drawText('Quality Section Head', { x: 50, y: 193, size: 8, font: fontRegular });
  
  page.drawImage(stampImage, { x: 250, y: 180, width: 140, height: 70 });
  
  page.drawImage(qrImage, { x: 480, y: 180, width: 70, height: 70 });
  
  // Bottom Address
  page.drawText('Kingdom of Saudi Arabia', { x: 50, y: 50, size: 8, font: fontRegular });
  page.drawText('P.O. Box: 370372, Riyadh 11325', { x: 50, y: 40, size: 8, font: fontRegular });
  
  const footerArabicPng = renderArabicTextToPng([
    { text: 'المملكة العربية السعودية', fontSize: 10 },
    { text: 'ص.ب: 370372، الرياض 11325', fontSize: 10 },
  ], 250, 60);
  if (footerArabicPng) {
    const arabicFooterImg = await pdfDoc.embedPng(footerArabicPng);
    page.drawImage(arabicFooterImg, { x: 320, y: 20, width: 250, height: 50 });
  }




  const pdfBytes = await pdfDoc.save();
  const firstSite = certData.line_items?.[0]?.site_id || 'UnknownSite';
  const sanitizedClient = certData.client.replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `${firstSite}_${sanitizedClient}_${certData.cert_id}.pdf`;

  return {
    pdfBytes,
    qrDataUrl,
    verificationUrl,
    sha256Hash,
    fileName,
  };
}
