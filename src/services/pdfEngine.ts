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
 */
export function buildVerificationUrl(certId: string, customDomain?: string): string {
  const cleanId = encodeURIComponent(certId.trim());
  if (customDomain && customDomain.trim()) {
    const base = customDomain.trim().replace(/\/+$/, '');
    return `${base}/verify/${cleanId}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/verify/${cleanId}`;
  }
  if (typeof process !== 'undefined' && process.env?.APP_URL) {
    const base = process.env.APP_URL.replace(/\/+$/, '');
    return `${base}/verify/${cleanId}`;
  }
  const vercelHost = typeof process !== 'undefined' ? (process.env?.VERCEL_PROJECT_PRODUCTION_URL || process.env?.VERCEL_URL) : undefined;
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/+$/, '')}/verify/${cleanId}`;
  }
  return `https://certifficationsystem.vercel.app/verify/${cleanId}`;
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
  const verificationUrl = buildVerificationUrl(certData.cert_id, host);
  certData.verification_url = verificationUrl;

  // 2. Generate canonical payload and SHA-256 hash
  const canonicalPayload = getCanonicalCertificatePayload(certData);
  const sha256Hash = certData.sha256_hash || (await generateSHA256Hash(canonicalPayload));

  // 3. Generate dynamic QR code in-memory
  const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);
  const qrImageBytes = dataUrlToUint8Array(qrDataUrl);

  // 4. Load official template PDF
  const templatePdfBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.templatePdfBase64);
  const templateDoc = await PDFDocument.load(templatePdfBytes);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`MYMF Galvanization Certificate ${certData.cert_id}`);
  pdfDoc.setAuthor('Mohammed Yehya Al-Aseery For Metal Industries (MYMAF)');
  pdfDoc.setSubject(`Hot-Dip Galvanization Inspection Certificate - BS EN ISO 1461 - ${certData.cert_id}`);
  pdfDoc.setKeywords(['QA/QC', 'Galvanization', 'ISO 1461', certData.cert_id, certData.client]);

  const [page] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(page);

  // Load standard Helvetica typefaces
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed dynamic QR Code
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  // Embed Stamp and Signature assets to support dynamic overlay if needed
  const stampImageBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.stampJpgBase64);
  const stampImage = await pdfDoc.embedJpg(stampImageBytes);

  const signImageBytes = dataUrlToUint8Array(TEMPLATE_ASSETS.signatureJpgBase64);
  const signImage = await pdfDoc.embedJpg(signImageBytes);

  // 1. Dynamic Certificate Reference Number
  // Overwrite "Cert. Ref. No.: MYF-QC-25-116."
  page.drawRectangle({
    x: 75,
    y: 628,
    width: 280,
    height: 18,
    color: rgb(1, 1, 1),
  });
  const refText = `Cert. Ref. No.: ${certData.cert_id}.`;
  page.drawText(refText, {
    x: 78.3,
    y: 635.02,
    size: 9.96,
    font: fontRegular,
    color: rgb(0, 0, 0),
  });

  // 2. Dynamic Issue Date (Red/Maroon color #C00000 matching template)
  page.drawRectangle({
    x: 105,
    y: 538,
    width: 140,
    height: 16,
    color: rgb(1, 1, 1),
  });
  page.drawText(certData.issue_date, {
    x: 116.9,
    y: 543.43,
    size: 9,
    font: fontRegular,
    color: rgb(0.753, 0, 0),
  });

  // 3. Dynamic Attestation Paragraph with Client Name
  page.drawRectangle({
    x: 112,
    y: 468,
    width: 465,
    height: 35,
    color: rgb(1, 1, 1),
  });

  const rawClient = certData.client.trim();
  const clientFormatted = rawClient.toLowerCase().startsWith('materials of')
    ? rawClient
    : `materials of ${rawClient}`;

  page.drawText(
    `Mohammed Yehya Al-Aseery Factory For Metal Industries ( MYMAF ) certifies that ${clientFormatted}, were`,
    {
      x: 116.9,
      y: 489.67,
      size: 9.96,
      font: fontRegular,
      color: rgb(0, 0, 0),
    }
  );
  page.drawText('hot dip galvanized in conformance to BS EN ISO 1461 Standard.', {
    x: 116.9,
    y: 476.83,
    size: 9.96,
    font: fontRegular,
    color: rgb(0, 0, 0),
  });

  // 4. Dynamic Line Items Table
  // Clear the existing template table area completely
  page.drawRectangle({
    x: 68,
    y: 315,
    width: 494,
    height: 112,
    color: rgb(1, 1, 1),
  });

  const tableX = 72;
  const tableW = 485;
  const startY = 422.5;
  const headerH = 18;
  const items = certData.line_items || [];
  const rowH = items.length > 2 ? 18 : 22;

  // Draw Header Box
  page.drawRectangle({
    x: tableX,
    y: startY - headerH,
    width: tableW,
    height: headerH,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  const colX = [72, 112, 165, 455, 508, 557];

  // Vertical dividers in header
  for (let i = 1; i < colX.length - 1; i++) {
    page.drawLine({
      start: { x: colX[i], y: startY },
      end: { x: colX[i], y: startY - headerH },
      color: rgb(0, 0, 0),
      thickness: 1,
    });
  }

  page.drawText('Item #', { x: 79, y: startY - 12.5, size: 9, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Site #', { x: 125, y: startY - 12.5, size: 9, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Description', { x: 278, y: startY - 12.5, size: 9, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Quantity', { x: 462, y: startY - 12.5, size: 9, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Unit', { x: 522, y: startY - 12.5, size: 9, font: fontBold, color: rgb(0, 0, 0) });

  // Draw Table Rows
  let curRowY = startY - headerH;

  for (let i = 0; i < Math.min(items.length, 3); i++) {
    const item = items[i];
    const rowTop = curRowY;
    const rowBottom = curRowY - rowH;

    page.drawRectangle({
      x: tableX,
      y: rowBottom,
      width: tableW,
      height: rowH,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    for (let c = 1; c < colX.length - 1; c++) {
      page.drawLine({
        start: { x: colX[c], y: rowTop },
        end: { x: colX[c], y: rowBottom },
        color: rgb(0, 0, 0),
        thickness: 1,
      });
    }

    const textY = rowBottom + (rowH - 9) / 2 + 1;

    // Item #
    page.drawText(String(item.item_no), {
      x: 89,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Site #
    page.drawText(item.site_id, {
      x: 121,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Description (cleanly truncated if long)
    const rawDesc = item.description || '';
    const desc = rawDesc.length > 55 ? rawDesc.slice(0, 52) + '...' : rawDesc;
    page.drawText(desc, {
      x: 172,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Quantity
    page.drawText(String(item.quantity), {
      x: 479,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Unit
    page.drawText(item.unit || '3M', {
      x: 524,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    curRowY -= rowH;
  }

  // 5. Ensure Stamp & Signature are crisp
  // Positioned exactly where they are in the attached template
  // Cover old QR code area cleanly
  page.drawRectangle({
    x: 450,
    y: 125,
    width: 105,
    height: 105,
    color: rgb(1, 1, 1),
  });

  // Embed the dynamic in-memory QR code at the exact template coordinates
  page.drawImage(qrImage, {
    x: 464.46,
    y: 136.56,
    width: 78.5,
    height: 78.5,
  });

  // Re-stamp to ensure 100% crisp overlay
  page.drawImage(stampImage, {
    x: 216.6,
    y: 216.36,
    width: 132.15,
    height: 68.25,
  });

  // Re-signature to ensure 100% crisp overlay
  page.drawImage(signImage, {
    x: 115.5,
    y: 230.36,
    width: 72.04,
    height: 40.1,
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `${certData.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_')}_Galv_Cert.pdf`;

  return {
    pdfBytes,
    qrDataUrl,
    verificationUrl,
    sha256Hash,
    fileName,
  };
}
