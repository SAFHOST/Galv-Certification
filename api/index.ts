import type { VercelRequest, VercelResponse } from '@vercel/node';
import { certificateRepository } from './storage';
import { generateCertificatePDF } from './pdfEngine';

import { CertificateDataSchema } from './certificateTypes';

/**
 * Consolidated API Handler for MYMF QA/QC Verification Engine.
 * This file is self-contained within the /api folder to ensure compatibility with Vercel Serverless.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 2. Route Normalization
  let url = req.url || '/';
  // Remove query params for routing
  const path = url.split('?')[0].replace(/\/$/, '') || '/';
  const method = req.method;

  console.log(`[API] ${method} ${path}`);

  try {
    // --- HEALTH / STATUS ---
    if (path === '/api' || path === '/api/health') {
      return res.json({
        service: 'MYMF QA/QC Verification Engine API (Consolidated)',
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.2.0'
      });
    }

    // --- CERTIFICATE ROUTES ---

    // GET /api/certificates - List all
    if (path === '/api/certificates' && method === 'GET') {
      const certificates = await certificateRepository.getAll();
      return res.json({ success: true, count: certificates.length, data: certificates });
    }

    // POST /api/certificates/generate - Create and store
    if (path === '/api/certificates/generate' && method === 'POST') {
      const parseResult = CertificateDataSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.issues,
        });
      }

      const certData = parseResult.data;

      const hostHeader = req.headers['x-forwarded-host'] || req.headers['host'] || 'mymf-portal.vercel.app';
      const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const hostDomain = `${protocol}://${hostHeader}`;

      if (!certData.cert_id) {
        certData.cert_id = `MYF-QC-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(100 + Math.random() * 900)}`;
      }

      certData.verification_url = `${hostDomain}/verify/${encodeURIComponent(certData.cert_id)}`;
      certData.created_at = new Date().toISOString();

      const pdfGen = await generateCertificatePDF(certData, { hostDomain });
      certData.sha256_hash = pdfGen.sha256Hash;

      const storageResult = await certificateRepository.save(certData, pdfGen.pdfBytes);

      return res.status(201).json({
        success: true,
        message: 'Certificate compiled and stored successfully',
        cert_id: certData.cert_id,
        verification_url: certData.verification_url,
        sha256_hash: pdfGen.sha256Hash,
        storage: storageResult,
        data: certData,
      });
    }

    // POST /api/certificates/preview - Return PDF binary
    if (path === '/api/certificates/preview' && method === 'POST') {
      const certData = req.body;
      if (!certData || !certData.cert_id) {
        return res.status(400).json({ success: false, error: 'Incomplete certificate data' });
      }
      
      const pdfGen = await generateCertificatePDF(certData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Certificate-ID', certData.cert_id);
      res.setHeader('Content-Disposition', `inline; filename="preview_${certData.cert_id}.pdf"`);
      return res.send(Buffer.from(pdfGen.pdfBytes));
    }

    // GET /api/certificates/:id/pdf - Stream stored PDF
    if (path.startsWith('/api/certificates/') && path.endsWith('/pdf') && method === 'GET') {
      const certId = path.split('/')[3];
      const cert = await certificateRepository.getById(certId);
      if (!cert) return res.status(404).json({ error: 'Certificate not found' });

      // In this serverless version, we might not have a binary cache if it wasn't just generated
      // So we regenerate it on the fly if needed, or fetch from storage if implemented
      // For now, regenerate to ensure it works
      const pdfGen = await generateCertificatePDF(cert);
      const filename = `${cert.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_')}_MYMF_Cert.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(Buffer.from(pdfGen.pdfBytes));
    }

    // GET /api/certificates/:id - Metadata only
    if (path.startsWith('/api/certificates/') && method === 'GET') {
      const certId = path.split('/')[3];
      const cert = await certificateRepository.getById(certId);
      if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });
      return res.json({ success: true, data: cert });
    }

    // POST /api/certificates/save
    if (path === '/api/certificates/save' && method === 'POST') {
       const cert = req.body;
       if (!cert || !cert.cert_id) return res.status(400).json({ error: 'Invalid payload' });
       await certificateRepository.save(cert);
       return res.json({ success: true, message: 'Saved', cert_id: cert.cert_id });
    }

    // POST /api/certificates/bulk-save
    if (path === '/api/certificates/bulk-save' && method === 'POST') {
       const certs = req.body;
       if (!Array.isArray(certs)) return res.status(400).json({ error: 'Expected array' });
       const count = await certificateRepository.saveBulk(certs);
       return res.json({ success: true, count });
    }

    // --- VERIFICATION ROUTES ---

    // GET /api/verify/:id
    if (path.startsWith('/api/verify/') && method === 'GET') {
      const certId = path.split('/')[3];
      const result = await certificateRepository.verify(certId);
      return res.json({ success: true, verification: result });
    }

    // POST /api/certificates/:id/revoke
    if (path.startsWith('/api/certificates/') && path.endsWith('/revoke') && method === 'POST') {
      const certId = path.split('/')[3];
      const cert = await certificateRepository.toggleRevocation(certId);
      if (!cert) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true, status: cert.status, data: cert });
    }

    // POST /api/certificates/reset
    if (path === '/api/certificates/reset' && method === 'POST') {
      await certificateRepository.resetToOriginal();
      return res.json({ success: true, message: 'Repository reset' });
    }

    // 404 Fallback
    return res.status(404).json({
      success: false,
      error: 'ROUTE_NOT_FOUND',
      message: `No handler for ${method} ${path}`,
      available_endpoints: [
        '/api/certificates',
        '/api/certificates/generate',
        '/api/certificates/preview',
        '/api/verify/:id'
      ]
    });

  } catch (err: any) {
    console.error('[SERVERLESS_ERROR]:', err);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
