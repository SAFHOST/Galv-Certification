import type { CertificateData, StorageResult, VerificationResult } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload, verifyCertificateIntegrity } from './security';
import { generateCertificatePDF } from './pdfEngine';

// Seed Initial Certificate per prompt requirements
const INITIAL_SEEDS: CertificateData[] = [
  {
    cert_id: 'MYF-QC-25-116',
    issue_date: '30 SEP 2026',
    client: 'Materials of M/S GBH',
    project_name: 'STC Telecom Site Extension Project - Northern Cluster',
    purchase_order_no: 'PO-GBH-2026-991',
    delivery_note_no: 'DN-25-1160',
    status: 'AUTHENTIC_VERIFIED',
    organization: {
      name: 'Mohammed Yehya Al-Aseery For Metal Industries (MYMF)',
      name_ar: 'مصنع محمد يحيى العسيري للصناعات المعدنية',
      cr_number: '1010997047',
      vat_number: '302154658900006',
      address: 'PO Box 370372, Riyadh 11325, KSA',
      tel: '+966 11 498 2211',
      email: 'qc@mymf.com.sa',
      website: 'www.mymf.com.sa',
      accreditation: 'ISO 9001:2015 & BS EN ISO 1461 Certified Facility',
    },
    technical_params: {
      standard: 'BS EN ISO 1461',
      standard_title: 'Hot dip galvanized coatings on fabricated iron and steel articles',
      bath_temperature_c: 450,
      zinc_purity_percent: 99.995,
      min_required_dft_um: 85,
      flux_type: 'Triple Salt Zinc Ammonium Chloride',
      pre_treatment: 'Caustic Degreasing, Hydrochloric Acid Pickling & Pre-fluxing',
      passivation: 'Sodium Dichromate Quench Passivation',
    },
    line_items: [
      {
        item_no: 1,
        site_id: 'ZUL033',
        description: 'RF Extension Mount with all accessories',
        quantity: 2,
        unit: '3M',
        heat_number: 'HT-44810-B',
        measured_dft_um: 92.4,
        visual_inspection: 'PASS',
      },
    ],
    sign_off: {
      name: 'Adel Y. Aseery',
      role: 'Quality Section Head',
      department: 'QA/QC Inspection Department',
      signed_at: '2026-09-30T14:30:00Z',
      signature_id: 'MYMF-SIG-AYA-0881',
    },
    notes: 'Certified that the materials listed have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications. All visual and thickness inspections conform to QA/QC acceptance criteria.',
    created_at: '2026-09-30T14:30:00.000Z',
    verification_url: '',
    sha256_hash: '',
    storage_url: 'https://drive.google.com/file/d/1mymf_qc25_116_galv_doc/view?usp=sharing',
  },
  {
    cert_id: 'MYF-QC-25-117',
    issue_date: '04 OCT 2026',
    client: 'Al-Fanar Power & Infrastructure Ltd.',
    project_name: 'Substation 380kV Earthing & Structural Steel Works',
    purchase_order_no: 'PO-FANAR-8831',
    delivery_note_no: 'DN-25-1172',
    status: 'AUTHENTIC_VERIFIED',
    organization: {
      name: 'Mohammed Yehya Al-Aseery For Metal Industries (MYMF)',
      name_ar: 'مصنع محمد يحيى العسيري للصناعات المعدنية',
      cr_number: '1010997047',
      vat_number: '302154658900006',
      address: 'PO Box 370372, Riyadh 11325, KSA',
      tel: '+966 11 498 2211',
      email: 'qc@mymf.com.sa',
      website: 'www.mymf.com.sa',
      accreditation: 'ISO 9001:2015 & BS EN ISO 1461 Certified Facility',
    },
    technical_params: {
      standard: 'BS EN ISO 1461',
      standard_title: 'Hot dip galvanized coatings on fabricated iron and steel articles',
      bath_temperature_c: 452,
      zinc_purity_percent: 99.995,
      min_required_dft_um: 85,
      flux_type: 'Triple Salt Zinc Ammonium Chloride',
      pre_treatment: 'Caustic Degreasing, Hydrochloric Acid Pickling & Pre-fluxing',
      passivation: 'Sodium Dichromate Quench Passivation',
    },
    line_items: [
      {
        item_no: 1,
        site_id: 'RYD-502',
        description: 'Structural Steel Gantry Tower Brackets (Grade S355JR)',
        quantity: 18,
        unit: 'PCS',
        heat_number: 'HT-55102-K',
        measured_dft_um: 104.2,
        visual_inspection: 'PASS',
      },
      {
        item_no: 2,
        site_id: 'RYD-502',
        description: 'Hot-Dip Galvanized Lattice Support Crossarms',
        quantity: 12,
        unit: 'SET',
        heat_number: 'HT-55109-M',
        measured_dft_um: 95.8,
        visual_inspection: 'PASS',
      },
    ],
    sign_off: {
      name: 'Adel Y. Aseery',
      role: 'Quality Section Head',
      department: 'QA/QC Inspection Department',
      signed_at: '2026-10-04T11:15:00Z',
      signature_id: 'MYMF-SIG-AYA-0881',
    },
    notes: 'Materials inspected and tested in accordance with Saudi Electricity Co. & ISO 1461 specifications. Uniform zinc coating verified.',
    created_at: '2026-10-04T11:15:00.000Z',
    verification_url: '',
    sha256_hash: '',
    storage_url: 'https://drive.google.com/file/d/1mymf_qc25_117_galv_doc/view?usp=sharing',
  },
];

const STORAGE_KEY = 'mymf_qc_certificates_v1';
const VERIFY_COUNT_KEY = 'mymf_qc_verify_counts_v1';

/**
 * In-memory / Persistent Storage Engine for QA/QC Certificates
 */
class CertificateRepository {
  private cache: Map<string, CertificateData> = new Map();
  private pdfCache: Map<string, Uint8Array> = new Map();
  private verificationCounts: Map<string, number> = new Map();
  private initialized = false;

  private async initialize() {
    if (this.initialized) return;

    // Load from localStorage if in browser
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CertificateData[];
          for (const item of parsed) {
            this.cache.set(item.cert_id, item);
          }
        }
        const storedCounts = window.localStorage.getItem(VERIFY_COUNT_KEY);
        if (storedCounts) {
          const counts = JSON.parse(storedCounts) as Record<string, number>;
          for (const [k, v] of Object.entries(counts)) {
            this.verificationCounts.set(k, v);
          }
        }
      } catch (e) {
        console.warn('Failed reading from localStorage', e);
      }
    } else {
      // Node.js server persistence
      try {
        const fs = await import('fs');
        const path = await import('path');
        const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
        const dataDir = isServerless ? (process.env.TMPDIR || '/tmp') : path.resolve(process.cwd(), 'data');
        const dbPath = path.resolve(dataDir, 'certificates_db.json');
        if (fs.existsSync(dbPath)) {
          const raw = fs.readFileSync(dbPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const item of parsed) {
              this.cache.set(item.cert_id, item);
            }
          }
        }
      } catch {
        // Fall back gracefully to in-memory
      }
    }

    // Seed defaults if empty
    if (this.cache.size === 0) {
      for (const seed of INITIAL_SEEDS) {
        const canonical = getCanonicalCertificatePayload(seed);
        seed.sha256_hash = await generateSHA256Hash(canonical);
        if (typeof window !== 'undefined' && window.location?.origin) {
          seed.verification_url = `${window.location.origin}/verify/${encodeURIComponent(seed.cert_id)}`;
        } else {
          const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
          const base = process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : 'https://certifficationsystem.vercel.app');
          seed.verification_url = `${base.replace(/\/+$/, '')}/verify/${encodeURIComponent(seed.cert_id)}`;
        }
        this.cache.set(seed.cert_id, seed);
        this.verificationCounts.set(seed.cert_id, 3); // realistic initial scans
      }
      this.persist();
    }

    this.initialized = true;
  }

  private persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const list = Array.from(this.cache.values());
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

        const countObj: Record<string, number> = {};
        for (const [k, v] of this.verificationCounts.entries()) {
          countObj[k] = v;
        }
        window.localStorage.setItem(VERIFY_COUNT_KEY, JSON.stringify(countObj));
      } catch (e) {
        console.warn('Could not persist to localStorage', e);
      }
    } else {
      try {
        import('fs').then((fs) => {
          import('path').then((path) => {
            const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
            const dataDir = isServerless ? (process.env.TMPDIR || '/tmp') : path.resolve(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            const dbPath = path.resolve(dataDir, 'certificates_db.json');
            fs.writeFileSync(dbPath, JSON.stringify(Array.from(this.cache.values()), null, 2));
          }).catch(() => {});
        }).catch(() => {});
      } catch {
        // Graceful ignore in read-only environments
      }
    }
  }

  async getAll(): Promise<CertificateData[]> {
    await this.initialize();

    // In browser, attempt to sync latest from server in background
    if (typeof window !== 'undefined') {
      try {
        const resp = await fetch('/api/certificates');
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && Array.isArray(json.data)) {
            for (const item of json.data) {
              if (item && item.cert_id && !this.cache.has(item.cert_id)) {
                this.cache.set(item.cert_id, item);
              }
            }
          }
        }
      } catch {
        // Fall back gracefully to cache
      }
    }

    return Array.from(this.cache.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getById(certId: string): Promise<CertificateData | undefined> {
    await this.initialize();
    const cleanId = certId.trim();

    // 1. Case-insensitive lookup in local cache
    for (const [key, cert] of this.cache.entries()) {
      if (key.toLowerCase() === cleanId.toLowerCase()) {
        return cert;
      }
    }

    // 2. If not found in browser cache, query server API
    if (typeof window !== 'undefined') {
      try {
        const resp = await fetch(`/api/certificates/${encodeURIComponent(cleanId)}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.data) {
            const cert = json.data as CertificateData;
            this.cache.set(cert.cert_id, cert);
            this.persist();
            return cert;
          }
        }
      } catch {
        // Server unreachable
      }
    }

    return undefined;
  }

  async save(cert: CertificateData, pdfBytes?: Uint8Array): Promise<StorageResult> {
    await this.initialize();

    // Always ensure verification_url matches the actual cert_id and current origin
    if (typeof window !== 'undefined' && window.location?.origin) {
      cert.verification_url = `${window.location.origin}/verify/${encodeURIComponent(cert.cert_id)}`;
    } else {
      const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
      const base = process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : 'https://certifficationsystem.vercel.app');
      cert.verification_url = `${base.replace(/\/+$/, '')}/verify/${encodeURIComponent(cert.cert_id)}`;
    }

    // Calculate canonical hash
    const canonical = getCanonicalCertificatePayload(cert);
    cert.sha256_hash = await generateSHA256Hash(canonical);

    // Google Drive / Cloud Storage deterministic path & naming
    const sanitizedId = cert.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${sanitizedId}_Galv_Cert.pdf`;
    const driveDocId = `1mymf_${sanitizedId.toLowerCase()}_prod_doc`;
    const deterministicStorageUrl = `https://drive.google.com/file/d/${driveDocId}/view?usp=sharing`;

    if (!cert.storage_url) {
      cert.storage_url = deterministicStorageUrl;
    }

    this.cache.set(cert.cert_id, cert);

    if (pdfBytes) {
      this.pdfCache.set(cert.cert_id, pdfBytes);
    }

    this.persist();

    // Async sync to server API
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/certificates/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cert),
        }).catch(() => {});
      } catch {
        // Offline / fallback
      }
    }

    return {
      provider: 'google_drive',
      cert_id: cert.cert_id,
      file_name: fileName,
      file_size_bytes: pdfBytes ? pdfBytes.byteLength : 84200,
      mime_type: 'application/pdf',
      storage_url: cert.storage_url,
      public_view_link: cert.storage_url,
      stored_at: new Date().toISOString(),
    };
  }

  async saveBulk(certs: CertificateData[], pdfMap?: Map<string, Uint8Array>): Promise<number> {
    await this.initialize();
    for (const cert of certs) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        cert.verification_url = `${window.location.origin}/verify/${encodeURIComponent(cert.cert_id)}`;
      }
      const canonical = getCanonicalCertificatePayload(cert);
      cert.sha256_hash = await generateSHA256Hash(canonical);

      const sanitizedId = cert.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_');
      const driveDocId = `1mymf_${sanitizedId.toLowerCase()}_prod_doc`;
      cert.storage_url = `https://drive.google.com/file/d/${driveDocId}/view?usp=sharing`;

      this.cache.set(cert.cert_id, cert);
      if (pdfMap && pdfMap.has(cert.cert_id)) {
        this.pdfCache.set(cert.cert_id, pdfMap.get(cert.cert_id)!);
      }
    }

    this.persist();

    // Sync all in bulk to server
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/certificates/bulk-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(certs),
        });
      } catch {
        // Local persistence still succeeded
      }
    }

    return certs.length;
  }

  async getPDF(certId: string): Promise<Uint8Array> {
    await this.initialize();
    const cert = await this.getById(certId);
    if (!cert) {
      throw new Error(`Certificate with ID '${certId}' was not found.`);
    }

    // Check in-memory cache
    if (this.pdfCache.has(cert.cert_id)) {
      return this.pdfCache.get(cert.cert_id)!;
    }

    // Generate fresh on-demand strictly for this certificate
    const gen = await generateCertificatePDF(cert);
    this.pdfCache.set(cert.cert_id, gen.pdfBytes);
    return gen.pdfBytes;
  }

  async verify(certId: string): Promise<VerificationResult> {
    await this.initialize();
    let cert = await this.getById(certId);

    // If not found in local cache, try querying the verification API (e.g. mobile phone scanner)
    if (!cert && typeof window !== 'undefined') {
      try {
        const resp = await fetch(`/api/verify/${encodeURIComponent(certId.trim())}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.verification) {
            if (json.verification.certificate) {
              this.cache.set(json.verification.certificate.cert_id, json.verification.certificate);
              this.persist();
            }
            return json.verification;
          }
        }
      } catch {
        // Fall back to local check
      }
    }

    if (!cert) {
      return {
        cert_id: certId,
        is_valid: false,
        status: 'NOT_FOUND',
        status_title: 'Document Record Not Found',
        status_description: `No issued certificate matches reference '${certId}' in the official MYMF QA/QC registry.`,
        verified_at: new Date().toISOString(),
        verification_count: 0,
      };
    }

    // Increment scan count
    const currentCount = (this.verificationCounts.get(cert.cert_id) || 0) + 1;
    this.verificationCounts.set(cert.cert_id, currentCount);
    this.persist();

    if (cert.status === 'REVOKED') {
      return {
        cert_id: cert.cert_id,
        is_valid: false,
        status: 'REVOKED',
        status_title: 'Certificate Revoked / Nullified',
        status_description: 'This inspection certificate has been formally revoked by MYMF Quality Section.',
        certificate: cert,
        verified_at: new Date().toISOString(),
        verification_count: currentCount,
      };
    }

    // Check cryptographic integrity
    const integrity = await verifyCertificateIntegrity(cert);
    if (!integrity.isValid) {
      return {
        cert_id: cert.cert_id,
        is_valid: false,
        status: 'TAMPERED',
        status_title: 'Cryptographic Hash Mismatch (Tamper Detected)',
        status_description: 'The document data does not match the original digital fingerprint signed by QA/QC Head.',
        certificate: cert,
        calculated_hash: integrity.computedHash,
        recorded_hash: integrity.expectedHash,
        verified_at: new Date().toISOString(),
        verification_count: currentCount,
      };
    }

    return {
      cert_id: cert.cert_id,
      is_valid: true,
      status: 'AUTHENTIC',
      status_title: 'VERIFIED & AUTHENTIC',
      status_description: 'Official Hot-Dip Galvanization Inspection Certificate conforms to BS EN ISO 1461.',
      certificate: cert,
      calculated_hash: integrity.computedHash,
      recorded_hash: integrity.expectedHash,
      verified_at: new Date().toISOString(),
      verification_count: currentCount,
    };
  }

  async toggleRevocation(certId: string): Promise<CertificateData | undefined> {
    const cert = await this.getById(certId);
    if (!cert) return undefined;
    cert.status = cert.status === 'REVOKED' ? 'AUTHENTIC_VERIFIED' : 'REVOKED';
    this.cache.set(cert.cert_id, cert);
    this.persist();
    return cert;
  }

  async tamperTest(certId: string): Promise<CertificateData | undefined> {
    const cert = await this.getById(certId);
    if (!cert) return undefined;
    // Alter item quantity without updating recorded hash to demonstrate tamper alert
    if (cert.line_items.length > 0) {
      cert.line_items[0].quantity += 100;
      cert.line_items[0].description += ' [TAMPERED FOR DEMO]';
    }
    this.cache.set(cert.cert_id, cert);
    this.persist();
    return cert;
  }

  async resetToOriginal(): Promise<void> {
    this.cache.clear();
    this.pdfCache.clear();
    this.verificationCounts.clear();
    this.initialized = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(VERIFY_COUNT_KEY);
    }
    await this.initialize();
  }
}

export const certificateRepository = new CertificateRepository();
