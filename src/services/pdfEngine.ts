import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import type { CertificateData } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload } from './security';
import { PDF_ASSETS } from './pdfAssets';

export interface PDFGenerationResult {
  pdfBytes: Uint8Array;
  qrDataUrl: string;
  verificationUrl: string;
  sha256Hash: string;
  fileName: string;
}

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { 
    errorCorrectionLevel: 'H', 
    margin: 0, 
    width: 280, 
    color: { dark: '#000000', light: '#ffffff' } 
  });
}

/**
 * Pure JS PDF Generator using pdf-lib.
 * No Chromium/Puppeteer dependency - 100% compatible with Vercel Serverless.
 */
export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  const host = options?.hostDomain || 'https://mymf-portal.vercel.app';
  const verificationUrl = `${host}/verify/${encodeURIComponent(certData.cert_id.trim())}`;
  
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));
  const qrCodeDataUrl = await generateQRCodeDataUrl(verificationUrl);
  
  // 1. Initialize PDF
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  // A4 dimensions: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // 2. Load Fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Load Cairo font for Arabic support
  let fontArabic;
  try {
    const fontBytes = Uint8Array.from(atob(PDF_ASSETS.fonts.cairo), c => c.charCodeAt(0));
    fontArabic = await pdfDoc.embedFont(fontBytes);
  } catch (e) {
    console.warn('[PDF Engine] Failed to load Cairo font, falling back to Helvetica');
    fontArabic = fontRegular;
  }

  // 3. Helper to draw images from base64
  const drawBase64Image = async (base64: string, x: number, y: number, w: number, h: number) => {
    try {
      const pureBase64 = base64.split(',')[1] || base64;
      const imgBytes = Uint8Array.from(atob(pureBase64), c => c.charCodeAt(0));
      
      let img: PDFImage;
      // Detect format by magic numbers
      // PNG: 89 50 4E 47
      const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4e && imgBytes[3] === 0x47;
      
      if (isPng) {
        img = await pdfDoc.embedPng(imgBytes);
      } else {
        img = await pdfDoc.embedJpg(imgBytes);
      }
      page.drawImage(img, { x, y, width: w, height: h });
    } catch (e) {
      console.error('[PDF Engine] Failed to draw image:', e);
    }
  };

  // 4. Draw Header
  // Left: English Details
  page.drawText("Mohammed Yehya Al-Aseery\nFor Metal Industries\nCR No: 1010997047\nVAT No: 302154658900006", {
    x: 40,
    y: height - 50,
    size: 8.5,
    font: fontRegular,
    lineHeight: 12,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Center: Logo (Increase size as requested)
  await drawBase64Image(PDF_ASSETS.images.logo, width / 2 - 30, height - 75, 60, 60);

  // Right: Arabic Details (RTL)
  // Note: pdf-lib doesn't handle RTL/reshaping automatically. 
  // We'll use the pre-reshaped text or draw simple blocks if needed.
  page.drawText("مصنع محمد يحيى العسيري\nللصناعات المعدنية\nس.ت: 1010997047\nالرقم الضريبي: 302154658900006", {
    x: width - 40,
    y: height - 50,
    size: 9.5,
    font: fontArabic,
    lineHeight: 12,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Top Divider
  page.drawLine({
    start: { x: 40, y: height - 90 },
    end: { x: width - 40, y: height - 90 },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  // 5. Certificate Title
  page.drawText("HOT DIP GALVANIZATION CERTIFICATE", {
    x: width / 2 - 130,
    y: height - 120,
    size: 13,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // 6. Metadata Row
  page.drawText(`Cert. Ref. No.: ${certData.cert_id}`, {
    x: 40,
    y: height - 145,
    size: 10,
    font: fontBold,
  });

  page.drawText(`Date: ${certData.issue_date}`, {
    x: width - 150,
    y: height - 145,
    size: 10,
    font: fontBold,
  });

  // 7. Certification Body Text
  const cleanClientName = certData.client
    .replace(/^Materials of M\/S\s+/i, '')
    .replace(/^Materials of\s+/i, '')
    .replace(/^M\/S\s+/i, '')
    .trim();

  const bodyText = `Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMAF) certifies that the materials of M/S ${cleanClientName} were hot-dip galvanized in conformance with BS EN ISO 1461 Standard.`;
  
  page.drawText(bodyText, {
    x: 40,
    y: height - 180,
    size: 10,
    font: fontRegular,
    maxWidth: width - 80,
    lineHeight: 14,
  });

  // 8. Line Items Table
  const tableTop = height - 230;
  const colWidths = [40, 140, 240, 50, 50]; // Item#, Site#, Desc, Qty, Unit
  const colX = [40, 80, 220, 460, 510];
  const headers = ['Item #', 'Site #', 'Description', 'Qty', 'Unit'];

  // Table Header Row
  page.drawRectangle({
    x: 40,
    y: tableTop - 15,
    width: width - 80,
    height: 20,
    color: rgb(0.9, 0.9, 0.9),
  });

  headers.forEach((h, i) => {
    page.drawText(h, {
      x: colX[i],
      y: tableTop - 2,
      size: 9,
      font: fontBold,
    });
  });

  // Rows
  let currentY = tableTop - 35;
  certData.line_items?.forEach((item, idx) => {
    const row = [
      (idx + 1).toString(),
      item.site_id || '-',
      item.description || '-',
      (item.quantity || 0).toString(),
      item.unit || 'PCS'
    ];

    row.forEach((text, i) => {
      page.drawText(text, {
        x: colX[i],
        y: currentY,
        size: 9,
        font: fontRegular,
        maxWidth: i === 2 ? 230 : undefined,
      });
    });

    currentY -= 20;
    
    // Horizontal line after each row
    page.drawLine({
      start: { x: 40, y: currentY + 15 },
      end: { x: width - 40, y: currentY + 15 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  });

  // 9. QR Code
  const qrImgBytes = Uint8Array.from(atob(qrCodeDataUrl.split(',')[1]), c => c.charCodeAt(0));
  const qrImg = await pdfDoc.embedPng(qrImgBytes);
  page.drawImage(qrImg, {
    x: 40,
    y: 60,
    width: 80,
    height: 80,
  });

  page.drawText("Scan to verify authenticity", {
    x: 40,
    y: 50,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // 10. Signature & Stamp
  // Right side bottom
  const sigX = width - 180;
  await drawBase64Image(PDF_ASSETS.images.signature, sigX, 100, 120, 40);
  await drawBase64Image(PDF_ASSETS.images.stamp, sigX + 40, 70, 70, 70);

  page.drawText("Adel Y. Aseery\nQuality Section Head", {
    x: sigX + 10,
    y: 60,
    size: 9,
    font: fontBold,
    lineHeight: 12,
  });

  // 11. Footer
  page.drawLine({
    start: { x: 40, y: 40 },
    end: { x: width - 40, y: 40 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  page.drawText("PO Box 370372, Riyadh 11325, KSA | Tel: +966 11 498 2211 | Email: qc@mymf.com.sa", {
    x: width / 2 - 180,
    y: 25,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Finalize
  const pdfBytes = await pdfDoc.save();
  const fileName = `${certData.line_items?.[0]?.site_id || 'Unknown'}_MYMF_Cert_${certData.cert_id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  return {
    pdfBytes,
    qrDataUrl: qrCodeDataUrl,
    verificationUrl,
    sha256Hash,
    fileName,
  };
}
