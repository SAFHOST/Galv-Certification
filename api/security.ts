import type { CertificateData } from './certificateTypes';

/**
 * Extracts canonical fields for tamper-evident hashing.
 * Transient fields like `storage_url` or `sha256_hash` are excluded.
 */
export function getCanonicalCertificatePayload(cert: Partial<CertificateData>): string {
  const canonicalObject = {
    cert_id: cert.cert_id?.trim(),
    issue_date: cert.issue_date?.trim(),
    client: cert.client?.trim(),
    project_name: cert.project_name?.trim(),
    purchase_order_no: cert.purchase_order_no?.trim(),
    standard: cert.technical_params?.standard?.trim(),
    line_items: (cert.line_items || []).map((item) => ({
      item_no: item.item_no,
      site_id: item.site_id.trim().toUpperCase(),
      description: item.description.trim(),
      quantity: item.quantity,
      unit: item.unit.trim().toUpperCase(),
      measured_dft_um: item.measured_dft_um ?? null,
      visual_inspection: item.visual_inspection,
    })),
    sign_off: {
      name: cert.sign_off?.name?.trim(),
      role: cert.sign_off?.role?.trim(),
    },
  };

  return JSON.stringify(canonicalObject, Object.keys(canonicalObject).sort());
}

/**
 * Generates an immutable SHA-256 hexadecimal string from the canonical payload.
 * Fully compatible with both Browser (Web Crypto API) and Node.js runtime environments.
 */
export async function generateSHA256Hash(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback if subtle is unavailable
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(payload).digest('hex');
  } catch (err) {
    console.error('Failed to access Node crypto module', err);
    throw new Error('No cryptographic provider available in current environment.');
  }
}

/**
 * Audits a certificate to detect any post-generation tampering or alteration.
 */
export async function verifyCertificateIntegrity(cert: CertificateData): Promise<{
  isValid: boolean;
  computedHash: string;
  expectedHash: string;
}> {
  const canonical = getCanonicalCertificatePayload(cert);
  const computedHash = await generateSHA256Hash(canonical);
  const expectedHash = cert.sha256_hash || '';

  const isValid = Boolean(expectedHash && computedHash.toLowerCase() === expectedHash.toLowerCase());
  return {
    isValid,
    computedHash,
    expectedHash,
  };
}

/**
 * Formats a SHA-256 hash for executive display (e.g., e7d1 82f9 ... 4a9b).
 */
export function formatHashDigest(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 8)} ${hash.slice(8, 16)} ... ${hash.slice(-8)}`;
}
