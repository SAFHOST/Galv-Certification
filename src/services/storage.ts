import type { CertificateData, StorageResult, VerificationResult } from '../types/certificate';
import { generateSHA256Hash, getCanonicalCertificatePayload, verifyCertificateIntegrity } from './security';
import { db, auth } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, query, Timestamp } from 'firebase/firestore';

// Seed Initial Certificate per prompt requirements
const INITIAL_SEEDS: CertificateData[] = [
  {
    cert_id: 'MYF-QC-26-239',
    issue_date: '24 OCT 2026',
    client: 'Metro TelWorks',
    project_name: 'STC Telecom Site Extension Project - Northern Cluster',
    purchase_order_no: 'PO-2026-GBH-8821',
    delivery_note_no: 'DN-25-8821',
    status: 'AUTHENTIC_VERIFIED',
    organization: {
      name: 'Mohammed Yehya Al-Aseery For Metal Industries (MYMF)',
      name_ar: 'مصنع محمد يحيى العسيري للصناعات المعدنية',
      cr_number: '1010207045',
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
        heat_number: 'HT-48901',
        measured_dft_um: 91.5,
        visual_inspection: 'PASS',
      },
    ],
    sign_off: {
      name: 'Adel Y. Aseery',
      role: 'Quality Section Head',
      department: 'QA/QC Inspection Department',
      signed_at: '2026-10-24T10:00:00Z',
      signature_id: 'MYMF-SIG-AYA-0881',
    },
    notes: 'Certified that the materials listed have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications. All visual and thickness inspections conform to QA/QC acceptance criteria.',
    created_at: '2026-10-24T10:00:00.000Z',
    verification_url: '',
    sha256_hash: '',
    storage_url: 'https://drive.google.com/file/d/1mymf_qc26_239_galv_doc/view?usp=sharing',
    verification_count: 0,
  },
  {
    cert_id: 'MYF-QC-25-116',
    issue_date: '30 SEP 2026',
    client: 'GBH',
    project_name: 'STC Telecom Site Extension Project - Northern Cluster',
    purchase_order_no: 'PO-GBH-2026-991',
    delivery_note_no: 'DN-25-1160',
    status: 'AUTHENTIC_VERIFIED',
    organization: {
      name: 'Mohammed Yehya Al-Aseery For Metal Industries (MYMF)',
      name_ar: 'مصنع محمد يحيى العسيري للصناعات المعدنية',
      cr_number: '1010207045',
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
    verification_count: 0,
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
      cr_number: '1010207045',
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
    verification_count: 0,
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
  private initialized = false;

  private async initialize() {
    if (this.initialized) return;

    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const certsRef = collection(db, 'certificates');
      const snapshot = await getDocs(certsRef);
      
      snapshot.forEach((doc) => {
        const data = doc.data() as CertificateData;
        this.cache.set(data.cert_id, data);
      });
    } catch (e) {
      console.warn('Failed to initialize certificates from Firestore:', e);
    }

    this.initialized = true;
  }
  
  async getPDF(certId: string): Promise<Uint8Array> {
    await this.initialize();
    if (this.pdfCache.has(certId)) {
      return this.pdfCache.get(certId)!;
    }
    
    // Regenerate PDF locally if not in cache
    const cert = await this.getById(certId);
    if (cert) {
      const { generateCertificatePDF } = await import('./pdfEngine');
      const { pdfBytes } = await generateCertificatePDF(cert);
      this.pdfCache.set(certId, pdfBytes);
      return pdfBytes;
    }
    
    throw new Error(`Certificate ${certId} not found to generate PDF`);
  }

  async addAudit(certId: string, action: string, metadata: any = {}) {
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db, auth } = await import('../lib/firebase');
      
      const auditRef = collection(db, 'certificates', certId, 'audit_trail');
      await addDoc(auditRef, {
        audit_id: crypto.randomUUID(),
        cert_id: certId,
        action: action,
        user_id: auth.currentUser?.uid || 'anonymous',
        timestamp: new Date().toISOString(),
        ...metadata
      });
    } catch (e) {
      console.error('Failed to log audit entry', e);
    }
  }

  async getAll(): Promise<CertificateData[]> {
    await this.initialize();
    
    // Refresh from Firestore
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const certsRef = collection(db, 'certificates');
      const snapshot = await getDocs(certsRef);
      
      snapshot.forEach((doc) => {
        const data = doc.data() as CertificateData;
        this.cache.set(data.cert_id, data);
      });
    } catch (e) {
      console.warn('Background sync failed:', e);
    }

    return Array.from(this.cache.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getById(certId: string): Promise<CertificateData | undefined> {
    const cleanId = certId.trim();
    
    // Check cache first
    const cached = this.cache.get(cleanId) || Array.from(this.cache.values()).find(c => c.cert_id.toLowerCase() === cleanId.toLowerCase());
    if (cached) return cached;

    // Query Firestore
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const docRef = doc(db, 'certificates', cleanId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as CertificateData;
        this.cache.set(data.cert_id, data);
        return data;
      }
    } catch (e) {
      console.error('Error fetching certificate from Firestore:', e);
    }

    return undefined;
  }

  async save(cert: CertificateData, pdfBytes?: Uint8Array): Promise<StorageResult> {
    // 1. Metadata setup
    if (typeof window !== 'undefined') {
      cert.verification_url = `${window.location.origin}/verify/${encodeURIComponent(cert.cert_id)}`;
    }
    
    const canonical = getCanonicalCertificatePayload(cert);
    cert.sha256_hash = await generateSHA256Hash(canonical);
    cert.status = 'AUTHENTIC_VERIFIED';
    
    if (!cert.created_at) cert.created_at = new Date().toISOString();

    // 2. Save to Firestore
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    await setDoc(doc(db, 'certificates', cert.cert_id), cert);
    
    this.cache.set(cert.cert_id, cert);
    if (pdfBytes) this.pdfCache.set(cert.cert_id, pdfBytes);

    await this.addAudit(cert.cert_id, 'CERTIFICATE_ISSUED', { client: cert.client });

    return {
      provider: 'firebase',
      cert_id: cert.cert_id,
      file_name: `${cert.cert_id}_Galv_Cert.pdf`,
      file_size_bytes: pdfBytes ? pdfBytes.byteLength : 0,
      mime_type: 'application/pdf',
      storage_url: cert.verification_url || '',
      public_view_link: cert.verification_url || '',
      stored_at: new Date().toISOString(),
    };
  }

  async saveBulk(certs: CertificateData[], pdfMap?: Map<string, Uint8Array>): Promise<number> {
    for (const cert of certs) {
      await this.save(cert, pdfMap?.get(cert.cert_id));
    }

    return certs.length;
  }

  async verify(certId: string): Promise<VerificationResult> {
    const cert = await this.getById(certId);

    if (!cert) {
      await this.addAudit(certId, 'VERIFICATION_ATTEMPT', { status: 'NOT_FOUND' });
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

    // Update scan count
    const newCount = (cert.verification_count || 0) + 1;
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    
    await updateDoc(doc(db, 'certificates', cert.cert_id), { verification_count: newCount });
    cert.verification_count = newCount;
    this.cache.set(cert.cert_id, cert);

    await this.addAudit(cert.cert_id, 'VERIFICATION_ATTEMPT', { status: 'SUCCESS', count: newCount });

    if (cert.status === 'REVOKED') {
      return {
        cert_id: cert.cert_id,
        is_valid: false,
        status: 'REVOKED',
        status_title: 'Certificate Revoked / Nullified',
        status_description: 'This inspection certificate has been formally revoked by MYMF Quality Section.',
        certificate: cert,
        verified_at: new Date().toISOString(),
        verification_count: newCount,
      };
    }

    const integrity = await verifyCertificateIntegrity(cert);
    return {
      cert_id: cert.cert_id,
      is_valid: integrity.isValid,
      status: integrity.isValid ? 'AUTHENTIC' : 'TAMPERED',
      status_title: integrity.isValid ? 'VERIFIED & AUTHENTIC' : 'Tamper Detected',
      status_description: integrity.isValid 
        ? 'Official Hot-Dip Galvanization Inspection Certificate conforms to BS EN ISO 1461.'
        : 'The document data does not match the original digital fingerprint.',
      certificate: cert,
      calculated_hash: integrity.computedHash,
      recorded_hash: integrity.expectedHash,
      verified_at: new Date().toISOString(),
      verification_count: newCount,
    };
  }

  async toggleRevocation(certId: string): Promise<CertificateData | undefined> {
    const cert = await this.getById(certId);
    if (!cert) return undefined;
    
    cert.status = cert.status === 'REVOKED' ? 'AUTHENTIC_VERIFIED' : 'REVOKED';
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    
    await updateDoc(doc(db, 'certificates', cert.cert_id), { status: cert.status });
    this.cache.set(cert.cert_id, cert);

    return cert;
  }

  async tamperTest(certId: string): Promise<CertificateData | undefined> {
    const cert = await this.getById(certId);
    if (!cert) return undefined;
    
    if (cert.line_items.length > 0) {
      cert.line_items[0].quantity += 100;
      cert.line_items[0].description += ' [TAMPERED FOR DEMO]';
    }
    
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    await updateDoc(doc(db, 'certificates', cert.cert_id), { line_items: cert.line_items });
    this.cache.set(cert.cert_id, cert);

    return cert;
  }

  async resetToOriginal(): Promise<void> {
    this.cache.clear();
    this.pdfCache.clear();
    this.initialized = false;
    await this.initialize();
  }
}

export const certificateRepository = new CertificateRepository();
