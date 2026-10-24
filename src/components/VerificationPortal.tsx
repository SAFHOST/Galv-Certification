import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  FileText,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  Award,
  RefreshCw,
  QrCode,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { CertificateData, VerificationResult } from '../types/certificate';
import { certificateRepository } from '../services/storage';
import { formatHashDigest } from '../services/security';
import { generateQRCodeDataUrl, buildVerificationUrl } from '../services/pdfEngine';

interface VerificationPortalProps {
  certId: string;
  onOpenPdf: (cert: CertificateData) => void;
  onOpenQR: (cert: CertificateData) => void;
  onSearchOther?: () => void;
  isAuthenticated?: boolean;
}

export const VerificationPortal: React.FC<VerificationPortalProps> = ({
  certId,
  onOpenPdf,
  onOpenQR,
  onSearchOther,
  isAuthenticated = false,
}) => {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadVerification = async () => {
    setLoading(true);
    try {
      const res = await certificateRepository.verify(certId);
      setResult(res);

      if (res && res.certificate) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        // Use buildVerificationUrl to ensure parameters are included, consistent with PDF
        const targetUrl = buildVerificationUrl(res.certificate);
        try {
          const qr = await generateQRCodeDataUrl(targetUrl);
          setQrDataUrl(qr);
        } catch {
          // Fallback to online image
        }
      }
    } catch (err) {
      console.error('Verification error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerification();
  }, [certId]);

  const handleCopyHash = () => {
    if (!result?.certificate?.sha256_hash) return;
    navigator.clipboard.writeText(result.certificate.sha256_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyUrl = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleTamperTest = async () => {
    if (!result?.certificate) return;
    await certificateRepository.tamperTest(result.certificate.cert_id);
    setActionMessage('Simulated tampering injected into line items. Re-evaluating cryptographic hash...');
    await loadVerification();
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleToggleRevoke = async () => {
    if (!result?.certificate) return;
    await certificateRepository.toggleRevocation(result.certificate.cert_id);
    setActionMessage('Certificate status updated in QA/QC registry.');
    await loadVerification();
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleReset = async () => {
    await certificateRepository.resetToOriginal();
    setActionMessage('Repository restored to genuine signed state.');
    await loadVerification();
    setTimeout(() => setActionMessage(null), 4000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-base font-semibold text-slate-800">Verifying Certificate Authenticity...</h2>
        <p className="text-xs text-slate-500 mt-1">Cross-referencing cryptographic SHA-256 hash with MYMF QA/QC registry</p>
      </div>
    );
  }

  if (!result || result.status === 'NOT_FOUND') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-6 text-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Certificate Not Found</h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto">
            The certificate reference <span className="font-mono font-semibold text-slate-900">{certId}</span> was not found in the official registry. Please check the reference number or contact MYMF Quality Assurance.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={onSearchOther}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Search Other Certificate
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cert = result.certificate!;
  const isAuthentic = result.status === 'AUTHENTIC';
  const isRevoked = result.status === 'REVOKED';
  const isTampered = result.status === 'TAMPERED';

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      {/* Toast Feedback */}
      {actionMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs flex items-center justify-between shadow-md">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white ml-2">×</button>
        </div>
      )}

      {/* Simplified Verification Result */}
      <div className={`rounded-2xl border p-6 text-center space-y-4 shadow-md ${
        isAuthentic ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
      }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
          isAuthentic ? 'bg-emerald-500' : 'bg-rose-500'
        }`}>
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isAuthentic ? 'Verified Authentic' : 'Verification Failed'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Certificate ID: <span className="font-mono font-semibold">{cert.cert_id}</span>
          </p>
        </div>

        <button
          onClick={() => onOpenPdf(cert)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download Certificate
        </button>
      </div>

      {/* Inspector Audit & Demonstration Controls (Visible Only to Authenticated Staff) */}
      {isAuthenticated && (
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Staff QA/QC Evaluator Controls
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTamperTest}
              className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              Simulate Tampering
            </button>
            <button
              onClick={handleToggleRevoke}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
            >
              {isRevoked ? 'Reinstate' : 'Revoke'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
