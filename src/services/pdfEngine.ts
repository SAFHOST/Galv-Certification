import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import arabicReshaper from 'arabic-reshaper';
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

/**
 * Reshapes and reverses Arabic text for pdf-lib rendering
 */
function fixArabicText(text: string): string {
  if (!text) return '';
  // Check if text contains Arabic characters
  if (!/[\u0600-\u06FF]/.test(text)) return text;
  
  try {
    const reshaped = arabicReshaper.reshape(text);
    return reshaped.split('').reverse().join('');
  } catch (e) {
    console.warn('[PDF Engine] Arabic reshaping failed:', e);
    return text;
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
  const headerTop = height - 40;
  
  // Left: English Details
  page.drawText("Mohammed Yehya Al-Aseery\nFor Metal Industries\nCR No: 1010997047\nVAT No: 302154658900006", {
    x: 40,
    y: headerTop,
    size: 8.5,
    font: fontRegular,
    lineHeight: 12,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Center: Logo (Balanced and Sharp)
  // Logo dimensions: 90x90. Centered at width/2
  await drawBase64Image(PDF_ASSETS.images.logo, width / 2 - 45, height - 100, 90, 90);

  // Right: Arabic Details (RTL reshaped)
  const arabicLine1 = fixArabicText("مصنع محمد يحيى العسيري");
  const arabicLine2 = fixArabicText("للصناعات المعدنية");
  const arabicLine3 = fixArabicText("س.ت: 1010997047");
  const arabicLine4 = fixArabicText("الرقم الضريبي: 302154658900006");

  const arabicX = width - 40;
  
  page.drawText(arabicLine1, { x: arabicX - fontArabic.widthOfTextAtSize(arabicLine1, 10), y: headerTop, size: 10, font: fontArabic });
  page.drawText(arabicLine2, { x: arabicX - fontArabic.widthOfTextAtSize(arabicLine2, 10), y: headerTop - 13, size: 10, font: fontArabic });
  page.drawText(arabicLine3, { x: arabicX - fontArabic.widthOfTextAtSize(arabicLine3, 10), y: headerTop - 26, size: 10, font: fontArabic });
  page.drawText(arabicLine4, { x: arabicX - fontArabic.widthOfTextAtSize(arabicLine4, 10), y: headerTop - 39, size: 10, font: fontArabic });

  // Top Divider
  page.drawLine({
    start: { x: 40, y: height - 105 },
    end: { x: width - 40, y: height - 105 },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  // 5. Certificate Title
  page.drawText("HOT DIP GALVANIZATION CERTIFICATE", {
    x: width / 2 - 140,
    y: height - 135,
    size: 15,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // 6. Metadata Row
  page.drawText(`Cert. Ref. No.: ${certData.cert_id}`, {
    x: 40,
    y: height - 165,
    size: 10,
    font: fontBold,
  });

  page.drawText(`Date: ${certData.issue_date}`, {
    x: width - 150,
    y: height - 165,
    size: 10,
    font: fontBold,
  });

  // 7. Certification Body Text
  const cleanClientName = certData.client
    .replace(/^Materials of M\/S\s+/i, '')
    .replace(/^Materials of\s+/i, '')
    .replace(/^M\/S\s+/i, '')
    .trim();

  const bodyText = `Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMF) certifies that the materials of M/S ${cleanClientName} were hot-dip galvanized in conformance with BS EN ISO 1461 Standard.`;
  
  page.drawText(bodyText, {
    x: 40,
    y: height - 205,
    size: 10,
    font: fontRegular,
    maxWidth: width - 80,
    lineHeight: 15,
  });

  // 8. Line Items Table
  let tableY = height - 260;
  
  // Adjusted colX for precise alignment: Item# (8%), Site# (27%), Desc (45%), Qty (10%), Unit (10%)
  // Total usable width = 515 (595 - 80)
  // 0: 40 (Start)
  // 1: 40 + 41 = 81 (Site#)
  // 2: 81 + 139 = 220 (Desc)
  // 3: 220 + 232 = 452 (Qty)
  // 4: 452 + 51 = 503 (Unit)
  const colX = [45, 85, 225, 465, 515];
  const headers = ['Item #', 'Site #', 'Description', 'Quantity', 'Unit'];
  
  page.drawRectangle({
    x: 40,
    y: tableY - 15,
    width: width - 80,
    height: 20,
    color: rgb(0.96, 0.96, 0.96),
  });

  headers.forEach((h, i) => {
    page.drawText(h, {
      x: colX[i],
      y: tableY - 2,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    });
  });

  // Row Data
  tableY -= 35;
  certData.line_items?.forEach((item, idx) => {
    const row = [
      (idx + 1).toString(),
      (item.site_id || '').toUpperCase(),
      item.description || '-',
      (item.quantity || 0).toString(),
      (item.unit || 'PCS').toUpperCase()
    ];

    row.forEach((text, i) => {
      page.drawText(text, {
        x: colX[i],
        y: tableY,
        size: 9,
        font: fontRegular,
        maxWidth: i === 2 ? 230 : undefined,
      });
    });

    tableY -= 20;
    
    // Row line
    page.drawLine({
      start: { x: 40, y: tableY + 15 },
      end: { x: width - 40, y: tableY + 15 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
  });

  // 9. QR Code (Bottom Left)
  const qrImgBytes = Uint8Array.from(atob(qrCodeDataUrl.split(',')[1]), c => c.charCodeAt(0));
  const qrImg = await pdfDoc.embedPng(qrImgBytes);
  page.drawImage(qrImg, {
    x: 40,
    y: 70,
    width: 80,
    height: 80,
  });

  page.drawText(fixArabicText("امسح للتحقق من صحة الشهادة"), {
    x: 40 + 40 - (fontArabic.widthOfTextAtSize(fixArabicText("امسح للتحقق من صحة الشهادة"), 7) / 2),
    y: 60,
    size: 7,
    font: fontArabic,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText("Scan to verify authenticity", {
    x: 40 + 40 - (fontRegular.widthOfTextAtSize("Scan to verify authenticity", 7) / 2),
    y: 50,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // 10. Signature & Stamp (Bottom Right)
  const rightX = width - 200;
  await drawBase64Image(PDF_ASSETS.images.signature, rightX + 20, 110, 140, 50);
  await drawBase64Image(PDF_ASSETS.images.stamp, rightX + 60, 70, 80, 80);

  page.drawText("Adel Y. Aseery\nQuality Section Head", {
    x: rightX + 40,
    y: 60,
    size: 10,
    font: fontBold,
    lineHeight: 12,
    color: rgb(0, 0, 0),
  });

  // 11. Footer
  page.drawLine({
    start: { x: 40, y: 40 },
    end: { x: width - 40, y: 40 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  const footerText = "PO Box 370372, Riyadh 11325, KSA | Tel: +966 11 498 2211 | Email: qc@mymf.com.sa";
  page.drawText(footerText, {
    x: width / 2 - (fontRegular.widthOfTextAtSize(footerText, 8) / 2),
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

