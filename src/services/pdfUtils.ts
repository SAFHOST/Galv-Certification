import QRCode from 'qrcode';
import type { CertificateData } from '../types/certificate';

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
