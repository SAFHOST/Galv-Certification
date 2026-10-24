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
  if (!base) base = 'http://localhost:3000';
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
    return dataUrlToUint8Array(canvas.toDataURL('image/png'));
  } catch { return null; }
}

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'H', margin: 0, width: 280, color: { dark: '#000000', light: '#ffffff' } });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

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

export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  const host = options?.hostDomain || (typeof window !== 'undefined' ? window.location.origin : undefined);
  const verificationUrl = buildVerificationUrl(certData, host);
  certData.verification_url = verificationUrl;
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));
  const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);
  const qrImageBytes = dataUrlToUint8Array(qrDataUrl);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const logoImage = await pdfDoc.embedJpg(dataUrlToUint8Array(TEMPLATE_ASSETS.logoJpgBase64));
  const stampImage = await pdfDoc.embedJpg(dataUrlToUint8Array(TEMPLATE_ASSETS.stampJpgBase64));
  const signImage = await pdfDoc.embedJpg(dataUrlToUint8Array(TEMPLATE_ASSETS.signatureJpgBase64));

  page.drawImage(logoImage, { x: 246, y: height - 100, width: 120, height: 60 });
  page.drawText('Mohammed Yehya Al-Aseery', { x: 50, y: height - 40, size: 9, font: fontBold });
  page.drawText('For Metal Industries', { x: 50, y: height - 52, size: 8, font: fontRegular });
  page.drawText('CR No: 1010997047', { x: 50, y: height - 64, size: 8, font: fontRegular });
  page.drawText('VAT No: 302154658900006', { x: 50, y: height - 76, size: 8, font: fontRegular });

  const headerArabicPng = renderArabicTextToPng([
    { text: 'مصنع محمد يحيى العسيري', fontSize: 16, isBold: true },
    { text: 'للصناعات المعدنية', fontSize: 12 },
    { text: 'س.ت: 1010997047', fontSize: 10 },
    { text: 'الرقم الضريبي: 302154658900006', fontSize: 10 },
  ], 250, 100);
  if (headerArabicPng) page.drawImage(await pdfDoc.embedPng(headerArabicPng), { x: 320, y: height - 90, width: 250, height: 80 });

  page.drawText('HOT DIP GALVANIZATION CERTIFICATE', { x: width / 2 - 130, y: height - 130, size: 14, font: fontBold });
  page.drawText(`Cert. Ref. No.: ${certData.cert_id}`, { x: 50, y: height - 150, size: 9, font: fontRegular });
  page.drawText(`Date: ${certData.issue_date}`, { x: 480, y: height - 150, size: 9, font: fontRegular });

  page.drawText(`Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMAF) certifies that the materials of M/S ${certData.client} were`, { x: 50, y: height - 180, size: 9, font: fontRegular });
  page.drawText('hot-dip galvanized in conformance with BS EN ISO 1461.', { x: 50, y: height - 192, size: 9, font: fontRegular });

  const tableY = height - 230;
  const tableX = 50;
  const tableWidth = 510;
  const colX = [tableX, tableX + 50, tableX + 130, tableX + 380, tableX + 450];
  const colWidths = [50, 80, 250, 70, 60];
  const headers = ['Item #', 'Site #', 'Description', 'Quantity', 'Unit'];
  
  page.drawRectangle({ x: tableX, y: tableY - 15, width: tableWidth, height: 25, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i] + 5, y: tableY - 8, size: 9, font: fontBold });
      if (i > 0) page.drawLine({ start: { x: colX[i], y: tableY - 15 }, end: { x: colX[i], y: tableY + 10 }, thickness: 1 });
  });

  let currentY = tableY - 15; // Set currentY to the top of the first row area
  certData.line_items?.forEach((item) => {
    const wrappedDescription = wrapText(item.description, fontRegular, 9, colWidths[2] - 10);
    const rowHeight = Math.max(25, wrappedDescription.length * 12 + 5);
    
    // Draw the row rectangle
    page.drawRectangle({ x: tableX, y: currentY - rowHeight, width: tableWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    
    // Draw vertical lines for the full row height
    for(let j=1; j<colX.length; j++) {
        page.drawLine({ start: { x: colX[j], y: currentY - rowHeight }, end: { x: colX[j], y: currentY }, thickness: 1 });
    }
    
    // Text position: vertically centered in the row (approximately)
    const textBaseY = currentY - 12; // Assuming 9pt font, 12pt line height
    
    page.drawText(String(item.item_no), { x: colX[0] + 5, y: textBaseY, size: 9, font: fontRegular });
    page.drawText(item.site_id, { x: colX[1] + 5, y: textBaseY, size: 9, font: fontRegular });
    
    // Draw wrapped description, line by line
    wrappedDescription.forEach((line, lineIdx) => {
        page.drawText(line, { x: colX[2] + 5, y: textBaseY - (lineIdx * 12), size: 9, font: fontRegular });
    });
    
    page.drawText(String(item.quantity), { x: colX[3] + 5, y: textBaseY, size: 9, font: fontRegular });
    page.drawText(item.unit, { x: colX[4] + 5, y: textBaseY, size: 9, font: fontRegular });
    
    // Move currentY down for the next row
    currentY -= rowHeight;
  });
  
  page.drawText('Mohammed Yehya Al-Aseery Factory For Metal Industries', { x: 50, y: 280, size: 9, font: fontRegular });
  page.drawText('MYMAF', { x: 50, y: 268, size: 9, font: fontRegular });
  page.drawImage(signImage, { x: 50, y: 220, width: 100, height: 40 });
  page.drawText('Adel Y. Aseery', { x: 50, y: 205, size: 9, font: fontRegular });
  page.drawText('Quality Section Head', { x: 50, y: 193, size: 8, font: fontRegular });
  page.drawImage(stampImage, { x: 250, y: 180, width: 140, height: 70 });
  page.drawImage(qrImage, { x: 480, y: 180, width: 70, height: 70 });
  page.drawText('Kingdom of Saudi Arabia', { x: 50, y: 50, size: 8, font: fontRegular });
  page.drawText('P.O. Box: 370372, Riyadh 11325', { x: 50, y: 40, size: 8, font: fontRegular });
  const footerArabicPng = renderArabicTextToPng([{ text: 'المملكة العربية السعودية', fontSize: 10 }, { text: 'ص.ب: 370372، الرياض 11325', fontSize: 10 }], 250, 60);
  if (footerArabicPng) page.drawImage(await pdfDoc.embedPng(footerArabicPng), { x: 320, y: 20, width: 250, height: 50 });

  return { pdfBytes: await pdfDoc.save(), qrDataUrl, verificationUrl, sha256Hash, fileName: `${certData.line_items?.[0]?.site_id || 'Unknown'}_${certData.client.replace(/[^a-zA-Z0-9-_]/g, '_')}_${certData.cert_id}.pdf` };
}
