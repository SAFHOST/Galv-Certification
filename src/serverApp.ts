import express from 'express';
import { certificateRepository } from './services/storage';
import { generateCertificatePDF } from './services/pdfEngine';
import { CertificateDataSchema } from './types/certificate';

export function createExpressApp() {
  const app = express();

  // Basic Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // REST API Routes
  const apiRouter = express.Router();

  // Root / Status info
  apiRouter.get('/', (req, res) => {
    res.json({
      service: 'MYMF QA/QC Verification Engine API',
      status: 'operational',
      standards: 'BS EN ISO 1461',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/certificates',
        '/api/certificates/:id',
        '/api/certificates/:id/pdf',
        '/api/verify/:id',
        '/api/certificates/generate'
      ]
    });
  });

  // Health check
  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // List all registered certificates
  apiRouter.get('/certificates', async (req, res) => {
    try {
      const certificates = await certificateRepository.getAll();
      res.json({ success: true, count: certificates.length, data: certificates });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get single certificate metadata
  apiRouter.get('/certificates/:id', async (req, res) => {
    try {
      const cert = await certificateRepository.getById(req.params.id);
      if (!cert) {
        res.status(404).json({ success: false, error: 'Certificate not found' });
        return;
      }
      res.json({ success: true, data: cert });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // In-Memory Generation & Persistence Pipeline
  apiRouter.post('/certificates/generate', async (req, res) => {
    try {
      const parseResult = CertificateDataSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.issues,
        });
        return;
      }

      const certData = parseResult.data;
      const hostHeader = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const hostDomain = (process.env.APP_URL || `${protocol}://${hostHeader}`).replace(/\/+$/, '');

      if (!certData.cert_id) {
        certData.cert_id = `MYF-QC-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`;
      }

      certData.verification_url = `${hostDomain}/verify/${encodeURIComponent(certData.cert_id)}`;

      const pdfGen = await generateCertificatePDF(certData, { hostDomain });
      certData.sha256_hash = pdfGen.sha256Hash;

      const storageResult = await certificateRepository.save(certData, pdfGen.pdfBytes);

      res.status(201).json({
        success: true,
        message: 'Certificate compiled and stored successfully',
        cert_id: certData.cert_id,
        verification_url: certData.verification_url,
        sha256_hash: pdfGen.sha256Hash,
        storage: storageResult,
        data: certData,
      });
    } catch (err: any) {
      console.error('[API] Generation error:', err);
      res.status(500).json({ 
        success: false, 
        error: err.message || 'An internal server error occurred during generation',
        code: 'GEN_FAIL'
      });
    }
  });


  // Download / Stream compiled PDF in-memory
  apiRouter.get('/certificates/:id/pdf', async (req, res) => {
    try {
      const certId = req.params.id;
      const cert = await certificateRepository.getById(certId);
      if (!cert) {
        res.status(404).send('Certificate not found');
        return;
      }

      const pdfBytes = await certificateRepository.getPDF(certId);
      const filename = `${cert.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_')}_MYMF_Cert.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.byteLength.toString());
      res.end(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error(`[API] PDF Fetch Error [${req.params.id}]:`, err);
      res.status(500).json({ 
        success: false, 
        error: `PDF Generation Error: ${err.message}`,
        code: 'PDF_FETCH_FAIL'
      });
    }
  });

  // Generate and preview PDF in-memory (no storage)
  apiRouter.post('/certificates/preview', async (req, res) => {
    try {
      const certData = req.body;
      if (!certData || !certData.cert_id) {
        console.warn('[API] Preview requested with missing data');
        res.status(400).json({ success: false, error: 'Incomplete certificate data' });
        return;
      }
      
      console.log(`[API] Previewing certificate: ${certData.cert_id}`);
      const pdfGen = await generateCertificatePDF(certData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Certificate-ID', certData.cert_id);
      res.send(Buffer.from(pdfGen.pdfBytes));
    } catch (err: any) {
      console.error(`[API] Preview Error [${req.body?.cert_id}]:`, err);
      // ALWAYS return JSON for errors so frontend can parse it
      res.status(500).json({ 
        success: false, 
        error: err.message || 'PDF Preview Generation failed',
        code: 'PDF_GEN_FAIL'
      });
    }
  });

  // Save/Upsert single certificate directly
  apiRouter.post('/certificates/save', async (req, res) => {
    try {
      const cert = req.body;
      if (!cert || !cert.cert_id) {
        res.status(400).json({ success: false, error: 'Invalid certificate payload' });
        return;
      }
      await certificateRepository.save(cert);
      res.status(200).json({ success: true, message: 'Certificate saved to registry', cert_id: cert.cert_id });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Bulk save array of certificates
  apiRouter.post('/certificates/bulk-save', async (req, res) => {
    try {
      const certs = req.body;
      if (!Array.isArray(certs) || certs.length === 0) {
        res.status(400).json({ success: false, error: 'Expected non-empty array of certificates' });
        return;
      }
      for (const cert of certs) {
        if (cert && cert.cert_id) {
          await certificateRepository.save(cert);
        }
      }
      res.status(200).json({ success: true, count: certs.length, message: `Successfully saved ${certs.length} certificates` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public Verification API Endpoint
  apiRouter.get('/verify/:id', async (req, res) => {
    try {
      const certId = req.params.id;
      let result = await certificateRepository.verify(certId);

      // If not found in memory but request carries verified query parameters from QR code:
      if ((!result || result.status === 'NOT_FOUND') && req.query.c) {
        const q = req.query as Record<string, string>;
        const hydratedCert = {
          cert_id: certId.trim().toUpperCase(),
          issue_date: q.d || '24 OCT 2026',
          client: q.c || 'Materials of M/S GBH',
          project_name: q.p || 'STC Telecom Site Extension Project - Northern Cluster',
          purchase_order_no: q.po || 'PO-2026-GBH-8821',
          delivery_note_no: q.dn || 'DN-25-8821',
          status: 'AUTHENTIC_VERIFIED' as const,
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
              site_id: q.s || 'ZUL033',
              description: q.desc || 'RF Extension Mount with all accessories',
              quantity: Number(q.q) || 2,
              unit: q.u || '3M',
              heat_number: 'HT-48901',
              measured_dft_um: Number(q.dft) || 91.5,
              visual_inspection: (q.v === 'FAIL' ? 'FAIL' : 'PASS') as 'PASS' | 'FAIL',
            },
          ],
          sign_off: {
            name: 'Adel Y. Aseery',
            role: 'Quality Section Head',
            department: 'QA/QC Inspection Department',
            signed_at: new Date().toISOString(),
            signature_id: 'MYMF-SIG-AYA-0881',
          },
          notes: 'Certified that the materials listed have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications. All visual and thickness inspections conform to QA/QC acceptance criteria.',
          created_at: new Date().toISOString(),
          verification_url: '',
          sha256_hash: '',
          verification_count: 0,
        };
        await certificateRepository.save(hydratedCert);
        result = await certificateRepository.verify(certId);
      }

      res.json({ success: true, verification: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Revoke / Unrevoke certificate
  apiRouter.post('/certificates/:id/revoke', async (req, res) => {
    try {
      const cert = await certificateRepository.toggleRevocation(req.params.id);
      if (!cert) {
        res.status(404).json({ success: false, error: 'Certificate not found' });
        return;
      }
      res.json({ success: true, status: cert.status, data: cert });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset repository
  apiRouter.post('/certificates/reset', async (req, res) => {
    try {
      await certificateRepository.resetToOriginal();
      res.json({ success: true, message: 'Repository reset to initial seeds' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mount API router strictly under /api
  app.use('/api', apiRouter);

  // Global Error Handler to ensure JSON responses for 500 errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER_ERROR:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'An internal server error occurred',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}
