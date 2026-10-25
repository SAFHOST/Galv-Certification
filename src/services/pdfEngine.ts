import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
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

// Helper: Word wrapping with break support for long continuous strings (Site IDs)
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, fontSize) <= maxWidth) {
            chunk += char;
          } else {
            lines.push(chunk);
            chunk = char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
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
 * Helper: Draw static Arabic header to base64 image (zero npm dependencies, zero crashes)
 * Uses browser Canvas to handle RTL, ligatures, and shaping perfectly.
 */
function getArabicHeaderImage(): string {
  if (typeof document === 'undefined') return ''; // Safety for SSR
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Use a clear background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set text properties
  ctx.textAlign = 'right';
  ctx.fillStyle = '#000000';
  
  // Line 1: Bold Company Name
  ctx.font = 'bold 28px Tahoma, Arial, sans-serif';
  ctx.fillText("مصنع محمد يحيى العسيري", 390, 35);
  
  // Line 2: Subtitle
  ctx.font = '24px Tahoma, Arial, sans-serif';
  ctx.fillText("للصناعات المعدنية", 390, 68);
  
  // Line 3: CR Number
  ctx.font = '22px Tahoma, Arial, sans-serif';
  ctx.fillText("س.ت: ١٠١٠٩٩٧٠٤٧", 390, 98);
  
  // Line 4: VAT Number
  ctx.fillText("الرقم الضريبي: ٣٠٢١٥٤٦٥٨٩٠٠٠٠٦", 390, 128);

  return canvas.toDataURL('image/png');
}

/**
 * Pure JS PDF Generator using pdf-lib.
 * 100% browser compatible - No server-side dependencies.
 * Arabic rendered via Canvas-to-Image for stability.
 */
export async function generateCertificatePDF(
  certData: CertificateData,
  options?: { hostDomain?: string }
): Promise<PDFGenerationResult> {
  const host = options?.hostDomain || (typeof window !== 'undefined' ? window.location.origin : 'https://mymf-portal.vercel.app');
  const verificationUrl = `${host}/verify/${encodeURIComponent(certData.cert_id.trim())}`;
  
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));
  const qrCodeDataUrl = await generateQRCodeDataUrl(verificationUrl);
  
  // 1. Initialize PDF
  const pdfDoc = await PDFDocument.create();
  
  // A4 dimensions: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // 2. Load Fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 3. Helper to draw images from base64
  const drawBase64Image = async (base64: string, x: number, y: number, w: number, h: number) => {
    try {
      if (!base64) return;
      const pureBase64 = base64.split(',')[1] || base64;
      const imgBytes = Uint8Array.from(atob(pureBase64), c => c.charCodeAt(0));
      
      let img: PDFImage;
      // Detect format by magic numbers
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
  // Left Header (English Company Details)
  page.drawText("Mohammed Yehya Al-Aseery\nFor Metal Industries\nCR No: 1010997047\nVAT No: 302154658900006", {
    x: 40,
    y: height - 52,
    size: 8.5,
    font: fontRegular,
    lineHeight: 12,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Center Logo (Balanced brand emblem)
  const logoW = 140;
  const logoH = 65;
  await drawBase64Image(PDF_ASSETS.images.logo, width / 2 - logoW / 2, height - 85, logoW, logoH);

  // Right Header (Arabic Company Details - Vector Canvas Image)
  const arabicHeaderBase64 = getArabicHeaderImage();
  if (arabicHeaderBase64) {
    await drawBase64Image(arabicHeaderBase64, width - 180, height - 85, 140, 48);
  }

  // Top Divider Line
  page.drawLine({
    start: { x: 40, y: height - 95 },
    end: { x: width - 40, y: height - 95 },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  // 5. Certificate Title
  page.drawText("HOT DIP GALVANIZATION CERTIFICATE", {
    x: width / 2 - 140,
    y: height - 120,
    size: 13,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // 6. Metadata Row
  page.drawText(`Cert. Ref. No.: ${certData.cert_id}`, {
    x: 40,
    y: height - 145,
    size: 9,
    font: fontBold,
  });

  page.drawText(`Date: ${certData.issue_date}`, {
    x: width - 150,
    y: height - 145,
    size: 9,
    font: fontBold,
  });

  // 7. Certification Body Text (Clean client name)
  const cleanClient = (certData.client || 'Valued Client').replace(/^Materials of M\/S\s*/i, '').trim();
  const statement = `Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMAF) certifies that the materials of M/S ${cleanClient} were hot-dip galvanized in conformance with BS EN ISO 1461 Standard.`;
  
  page.drawText(statement, {
    x: 40,
    y: height - 172,
    size: 9,
    font: fontRegular,
    maxWidth: width - 80,
    lineHeight: 13,
  });

  // 8. Line Items Table (Dynamic Height & Wrapping)
  const tableTop = height - 215;
  const colX = { item: 40, site: 75, desc: 230, qty: 470, unit: 515 };

  // Header Box (Continuous attachment to rows)
  const headerHeight = 22;
  page.drawRectangle({
    x: 40,
    y: tableTop - headerHeight,
    width: width - 80,
    height: headerHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95),
  });

  const headerY = tableTop - 15;
  page.drawText("Item #", { x: colX.item + 5, y: headerY, size: 8, font: fontBold });
  page.drawText("Site #", { x: colX.site + 5, y: headerY, size: 8, font: fontBold });
  page.drawText("Description of Articles", { x: colX.desc + 5, y: headerY, size: 8, font: fontBold });
  page.drawText("Qty", { x: colX.qty + 10, y: headerY, size: 8, font: fontBold });
  page.drawText("Unit", { x: colX.unit + 8, y: headerY, size: 8, font: fontBold });

  let currentY = tableTop - headerHeight;
  const rowLineHeight = 11;
  const paddingY = 8;

  certData.line_items?.forEach((item, idx) => {
    const siteNo = (item.site_id || '').toUpperCase();
    const description = item.description || '-';
    
    const siteLines = wrapText(siteNo, 145, fontRegular, 8);
    const descLines = wrapText(description, 230, fontRegular, 8);
    const maxLines = Math.max(siteLines.length, descLines.length, 1);
    const rowHeight = maxLines * rowLineHeight + paddingY * 2;

    // Draw Dynamic Row Border
    page.drawRectangle({
      x: 40,
      y: currentY - rowHeight,
      width: width - 80,
      height: rowHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    });

    // Item #
    page.drawText((idx + 1).toString(), {
      x: colX.item + 10,
      y: currentY - paddingY - 8,
      size: 8,
      font: fontRegular,
    });

    // Wrapped Site ID
    siteLines.forEach((line, i) => {
      page.drawText(line, {
        x: colX.site + 5,
        y: currentY - paddingY - 8 - (i * rowLineHeight),
        size: 8,
        font: fontRegular,
      });
    });

    // Wrapped Description
    descLines.forEach((line, i) => {
      page.drawText(line, {
        x: colX.desc + 5,
        y: currentY - paddingY - 8 - (i * rowLineHeight),
        size: 8,
        font: fontRegular,
      });
    });

    // Qty & Unit
    page.drawText((item.quantity || 0).toString(), {
      x: colX.qty + 12,
      y: currentY - paddingY - 8,
      size: 8,
      font: fontRegular,
    });
    page.drawText((item.unit || 'PCS').toUpperCase(), {
      x: colX.unit + 10,
      y: currentY - paddingY - 8,
      size: 8,
      font: fontRegular,
    });

    // Advance Y downward
    currentY -= rowHeight;
  });

  // 9. SIGNATURE, STAMP, AND VERIFICATION QR CODE (PINNED TO BOTTOM)
  // Pin footer elements relative to bottom or currentY
  const footerY = Math.min(currentY - 35, 170);

  // Left: Authority & Adel Signature
  page.drawText("Mohammed Yehya Al-Aseery Factory (MYMAF)", { x: 40, y: footerY + 50, size: 9, font: fontBold });
  await drawBase64Image(PDF_ASSETS.images.signature, 40, footerY + 5, 85, 40);
  page.drawText("Adel Y. Aseery\nQuality Section Head", { x: 40, y: footerY - 10, size: 8, font: fontRegular, lineHeight: 11 });

  // Center: Blue Factory Stamp
  await drawBase64Image(PDF_ASSETS.images.stamp, width / 2 - 55, footerY - 15, 110, 65);

  // Right: Scannable Verification QR Code
  const qrW = 85;
  const qrH = 85;
  const qrImgBytes = Uint8Array.from(atob(qrCodeDataUrl.split(',')[1]), c => c.charCodeAt(0));
  const qrImg = await pdfDoc.embedPng(qrImgBytes);
  page.drawImage(qrImg, { x: width - 130, y: footerY - 15, width: qrW, height: qrH });
  page.drawText("Scan to Verify", { x: width - 118, y: footerY - 24, size: 7, font: fontRegular });

  // 10. Bottom Legal Divider & Location Bar
  page.drawLine({ start: { x: 40, y: 55 }, end: { x: width - 40, y: 55 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText("Kingdom of Saudi Arabia | P.O. Box: 370372, Riyadh 11325", {
    x: width / 2 - 130,
    y: 42,
    size: 8,
    font: fontRegular,
  });

  // Finalize
  const pdfBytes = await pdfDoc.save();
  const fileName = `${certData.cert_id.replace(/[^a-zA-Z0-9]/g, '_')}_MYMF_Cert.pdf`;

  return {
    pdfBytes,
    qrDataUrl: qrCodeDataUrl,
    verificationUrl,
    sha256Hash,
    fileName,
  };
}



