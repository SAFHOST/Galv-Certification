import express from 'express';
import { certificateRepository } from './services/storage';
import { generateCertificatePDF } from './services/pdfEngine';
import { CertificateDataSchema } from './types/certificate';

export function createExpressApp() {
  const app = express();

  // Basic Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

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
      console.error('Generation error:', err);
      res.status(500).json({ success: false, error: err.message });
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
      res.status(500).send(`PDF Generation Error: ${err.message}`);
    }
  });

  // Public Verification API Endpoint
  apiRouter.get('/verify/:id', async (req, res) => {
    try {
      const result = await certificateRepository.verify(req.params.id);
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

  return app;
}
