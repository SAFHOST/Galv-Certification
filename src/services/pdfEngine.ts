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
 * 100% browser compatible - No server-side dependencies.
 * English-only to ensure font stability.
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

  // 2. Load Standard Fonts
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
  const headerTop = height - 50;
  
  // Left: English Company Info
  page.drawText("Mohammed Yehya Al-Aseery\nFor Metal Industries\nCR No: 1010997047\nVAT No: 302154658900006", {
    x: 40,
    y: headerTop,
    size: 9,
    font: fontRegular,
    lineHeight: 13,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Center: Logo
  await drawBase64Image(PDF_ASSETS.images.logo, width / 2 - 45, height - 105, 90, 90);

  // Right: English Factory Details (Alternative to Arabic as requested)
  page.drawText("MYMF Factory Group\nMetal Fabrication Division\nQuality Assurance Dept.\nKingdom of Saudi Arabia", {
    x: width - 160,
    y: headerTop,
    size: 9,
    font: fontRegular,
    lineHeight: 13,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Top Divider
  page.drawLine({
    start: { x: 40, y: height - 115 },
    end: { x: width - 40, y: height - 115 },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  // 5. Certificate Title
  page.drawText("HOT DIP GALVANIZATION CERTIFICATE", {
    x: width / 2 - 150,
    y: height - 145,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // 6. Metadata Row
  page.drawText(`Certificate Ref: ${certData.cert_id}`, {
    x: 40,
    y: height - 175,
    size: 10,
    font: fontBold,
  });

  page.drawText(`Issue Date: ${certData.issue_date}`, {
    x: width - 160,
    y: height - 175,
    size: 10,
    font: fontBold,
  });

  // 7. Certification Body Text
  const clientName = certData.client || 'Valued Client';
  const bodyText = `Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMF) certifies that the materials listed below for ${clientName} have been hot-dip galvanized in strict conformance with BS EN ISO 1461 Standard specifications.`;
  
  page.drawText(bodyText, {
    x: 40,
    y: height - 215,
    size: 10,
    font: fontRegular,
    maxWidth: width - 80,
    lineHeight: 15,
  });

  // 8. Line Items Table
  let tableY = height - 270;
  const colX = [45, 100, 240, 470, 520];
  const headers = ['Item #', 'Site ID', 'Description of Articles', 'Qty', 'Unit'];
  
  // Header background
  page.drawRectangle({
    x: 40,
    y: tableY - 15,
    width: width - 80,
    height: 20,
    color: rgb(0.95, 0.95, 0.95),
  });

  // Headers
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
        maxWidth: i === 2 ? 220 : undefined,
      });
    });

    tableY -= 20;
    
    // Row separator
    page.drawLine({
      start: { x: 40, y: tableY + 15 },
      end: { x: width - 40, y: tableY + 15 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  });

  // 9. Technical Specs
  tableY -= 20;
  page.drawText("Technical Specifications & Standards:", {
    x: 40,
    y: tableY,
    size: 10,
    font: fontBold,
  });
  
  tableY -= 15;
  const specs = [
    `Galvanizing Standard: ${certData.technical_params?.standard || 'BS EN ISO 1461'}`,
    `Zinc Bath Temp: ${certData.technical_params?.bath_temperature_c || 450}°C`,
    `Zinc Purity: ${certData.technical_params?.zinc_purity_percent || 99.995}%`,
    `Min. Required DFT: ${certData.technical_params?.min_required_dft_um || 85} µm`
  ];
  
  specs.forEach(spec => {
    page.drawText(`• ${spec}`, {
      x: 50,
      y: tableY,
      size: 9,
      font: fontRegular,
    });
    tableY -= 12;
  });

  // 10. QR Code (Bottom Left)
  try {
    const pureQrBase64 = qrCodeDataUrl.split(',')[1];
    const qrImgBytes = Uint8Array.from(atob(pureQrBase64), c => c.charCodeAt(0));
    const qrImg = await pdfDoc.embedPng(qrImgBytes);
    page.drawImage(qrImg, {
      x: 40,
      y: 60,
      width: 75,
      height: 75,
    });
    
    page.drawText("Scan to verify authenticity", {
      x: 40,
      y: 50,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
  } catch (e) {
    console.error("QR embedding failed", e);
  }

  // 11. Sign-off (Bottom Right)
  const rightX = width - 180;
  await drawBase64Image(PDF_ASSETS.images.signature, rightX, 100, 120, 40);
  await drawBase64Image(PDF_ASSETS.images.stamp, rightX + 80, 60, 70, 70);

  page.drawText("Authorized Signature", {
    x: rightX,
    y: 90,
    size: 9,
    font: fontBold,
  });
  
  page.drawText(`${certData.sign_off?.name || 'Adel Y. Aseery'}\n${certData.sign_off?.role || 'Quality Head'}`, {
    x: rightX,
    y: 75,
    size: 8,
    font: fontRegular,
    lineHeight: 10,
  });

  // 12. Footer
  page.drawLine({
    start: { x: 40, y: 40 },
    end: { x: width - 40, y: 40 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  const footerLine = "PO Box 370372, Riyadh 11325, KSA | Tel: +966 11 498 2211 | Email: qc@mymf.com.sa | www.mymf.com.sa";
  page.drawText(footerLine, {
    x: width / 2 - (fontRegular.widthOfTextAtSize(footerLine, 8) / 2),
    y: 25,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
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


