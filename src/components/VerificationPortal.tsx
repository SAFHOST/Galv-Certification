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
import { generateQRCodeDataUrl } from '../services/pdfEngine';

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
        const targetUrl = `${origin}/verify/${encodeURIComponent(res.certificate.cert_id)}`;
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
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Toast Feedback */}
      {actionMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs flex items-center justify-between shadow-md">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white ml-2">×</button>
        </div>
      )}

      {/* Main Status Verification Banner */}
      <div
        className={`rounded-xl border p-5 sm:p-6 transition-colors shadow-xs ${
          isAuthentic
            ? 'bg-emerald-50/70 border-emerald-300'
            : isTampered
            ? 'bg-rose-50 border-rose-300'
            : 'bg-amber-50 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isAuthentic
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isTampered
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-amber-600 text-white shadow-sm'
              }`}
            >
              {isAuthentic && <ShieldCheck className="w-7 h-7" />}
              {isTampered && <ShieldAlert className="w-7 h-7" />}
              {isRevoked && <AlertTriangle className="w-7 h-7" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md ${
                    isAuthentic
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : isTampered
                      ? 'bg-rose-100 text-rose-800 font-bold'
                      : 'bg-amber-100 text-amber-800 font-bold'
                  }`}
                >
                  {result.status_title}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Ref: <strong className="text-slate-900">{cert.cert_id}</strong>
                </span>
              </div>

              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                {isAuthentic
                  ? 'Official Inspection Document Verified'
                  : isTampered
                  ? 'Tampering Detected: Data Mismatch'
                  : 'Document Revoked by Quality Authority'}
              </h1>

              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                {result.status_description}
              </p>
            </div>
          </div>

          {/* Quick Actions in Banner */}
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={() => onOpenPdf(cert)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-700" />
              View PDF
            </button>
            <button
              onClick={() => onOpenQR(cert)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white/70 hover:bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              Show QR
            </button>
          </div>
        </div>

        {/* Verification Metadata Footnote */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>Verified on-site: {new Date(result.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>·</span>
            <span>Scan Count: {result.verification_count}</span>
            <span>·</span>
            <span className="text-emerald-700 font-medium">BS EN ISO 1461 Compliant</span>
          </div>

          <button
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
          >
            {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copiedUrl ? 'Link Copied' : 'Share Verification Link'}</span>
          </button>
        </div>
      </div>

      {/* Authentic Physical Document Representation Matching Attached Template */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-10 font-sans space-y-6">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          {/* Left: English Company Meta */}
          <div className="text-xs space-y-0.5 text-slate-800">
            <div className="font-bold text-sm text-slate-900">Mohammed Yehya Al-Aseery</div>
            <div className="text-slate-600">For Metal Industries</div>
            <div className="text-slate-600 font-mono text-[11px]">CR NO: 1010997047</div>
            <div className="text-slate-600 font-mono text-[11px] pt-1">VAT NO: 302154658900006</div>
            <div className="font-mono font-bold text-slate-900 text-xs pt-1">
              Cert. Ref. No.: {cert.cert_id}.
            </div>
          </div>

          {/* Center: Official MYMF Tower Logo */}
          <div className="flex flex-col items-center justify-center shrink-0 mx-auto sm:mx-0">
            <img
              src="/assets/template/mymf_logo.jpg"
              alt="MYMF Steel Fabricator Logo"
              className="h-16 sm:h-20 object-contain"
            />
          </div>

          {/* Right: Arabic Company Meta */}
          <div className="text-xs text-right space-y-0.5 text-slate-800 font-arabic self-end sm:self-center">
            <div className="font-bold text-sm text-slate-900">مصنع محمد يحيى العسيري</div>
            <div className="text-slate-600">للصناعات المعدنية س .ت :.</div>
            <div className="text-slate-600 font-mono text-[11px]">1010207045</div>
            <div className="text-slate-600 font-mono text-[11px] pt-1">الرقم الضريبي : 302154658900006</div>
          </div>
        </div>

        {/* Header Horizontal Line */}
        <div className="w-full h-[1px] bg-black"></div>

        {/* Title & Date Block */}
        <div className="relative flex flex-col items-center justify-center text-center py-2">
          {/* Red Date on Left */}
          <div className="sm:absolute left-0 top-3 text-red-700 font-bold text-xs uppercase tracking-wider">
            {cert.issue_date}
          </div>

          {/* Center Title */}
          <div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-widest text-slate-900 underline underline-offset-4 decoration-1">
              CERTIFICATE
            </h2>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mt-1">
              HOT-DIP-GALVANIZATION
            </div>
          </div>
        </div>

        {/* Attestation Certification Paragraph */}
        <div className="text-xs sm:text-sm text-slate-900 leading-relaxed pt-2">
          Mohammed Yehya Al-Aseery Factory For Metal Industries ( MYMAF ) certifies that{' '}
          {cert.client.toLowerCase().startsWith('materials of') ? cert.client : `materials of ${cert.client}`}, were
          hot dip galvanized in conformance to BS EN ISO 1461 Standard.
        </div>

        {/* Official Line Items Table with crisp black borders */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border border-black border-collapse">
            <thead>
              <tr className="border-b border-black font-bold text-slate-900 text-center">
                <th className="py-2 px-3 border-r border-black w-16">Item #</th>
                <th className="py-2 px-3 border-r border-black w-24">Site #</th>
                <th className="py-2 px-4 border-r border-black text-center">Description</th>
                <th className="py-2 px-3 border-r border-black w-20">Quantity</th>
                <th className="py-2 px-3 w-16">Unit</th>
              </tr>
            </thead>
            <tbody className="text-slate-900 font-normal">
              {(cert.line_items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-black text-center">
                  <td className="py-2.5 px-3 border-r border-black font-mono">{item.item_no}</td>
                  <td className="py-2.5 px-3 border-r border-black font-mono font-bold">{item.site_id}</td>
                  <td className="py-2.5 px-4 border-r border-black text-center font-medium">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-3 border-r border-black font-mono font-bold">{item.quantity}</td>
                  <td className="py-2.5 px-3 font-mono">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Sign-off, Stamp & Dynamic QR Code Block */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end pt-6">
          {/* Left: Organization & Sign-off Head with Signature */}
          <div className="space-y-1 text-xs text-slate-900">
            <div className="font-semibold text-slate-800">
              Mohammed Yehya Al-Aseery Factory For
            </div>
            <div className="font-semibold text-slate-800">Metal Industries</div>
            <div className="font-bold text-slate-900 tracking-wider">MYMAF</div>

            {/* Exact Official Signature from Template */}
            <div className="py-1">
              <img
                src="/assets/template/adel_signature.jpg"
                alt="Adel Y. Aseery Signature"
                className="h-10 object-contain"
              />
            </div>

            <div className="pt-1">
              <div className="font-bold text-slate-900 border-b border-black pb-0.5 inline-block min-w-[130px]">
                {cert.sign_off?.name || 'Adel Y.Aseery.'}
              </div>
              <div className="text-[11px] text-slate-700 mt-0.5">
                {cert.sign_off?.role || 'Quality Section Head'}
              </div>
            </div>
          </div>

          {/* Center: Exact Blue Arabic Official Stamp from Template */}
          <div className="flex flex-col items-center justify-center text-center">
            <img
              src="/assets/template/mymf_stamp.jpg"
              alt="Official Stamp مصنع محمد يحيى العسيري"
              className="h-20 object-contain shadow-xs border border-blue-100"
            />
            <span className="text-[9px] text-slate-400 font-mono mt-1">OFFICIAL MYMF STAMP AFFIXED</span>
          </div>

          {/* Right: Dynamic Embedded Verification QR Code */}
          <div className="flex flex-col items-center sm:items-end justify-center">
            <div className="border border-black p-1 bg-white">
              <img
                src={`/api/verify/${encodeURIComponent(cert.cert_id)}`}
                onError={(e) => {
                  // Fallback to QR modal data or direct QR
                  (e.target as HTMLElement).style.display = 'none';
                }}
                alt="QR Code"
                className="hidden"
              />
              <div className="w-20 h-20 bg-white flex items-center justify-center">
                {/* Embedded Dynamic QR Code strictly matching certificate */}
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Dynamic QR Code for ${cert.cert_id}`}
                    className="w-20 h-20 object-contain"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `${window.location.origin}/verify/${encodeURIComponent(cert.cert_id)}`
                    )}`}
                    alt="Dynamic QR Code"
                    className="w-20 h-20 object-contain"
                  />
                )}
              </div>
            </div>
            <span className="text-[9px] font-mono text-slate-500 mt-1">SCAN TO VERIFY</span>
          </div>
        </div>

        {/* Template Footer with Kingdom Address */}
        <div className="pt-6 border-t border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div>
            <div>Kingdom Of Saudi Arabia</div>
            <div className="text-[11px]">PO Box NO: 370372 Riyadh 11325</div>
          </div>
          <div className="text-right font-arabic self-end sm:self-center">
            <div>المملكة العربية السعودية ص.ب :</div>
            <div className="text-[11px] font-mono">370372   الرياض   11325</div>
          </div>
        </div>
      </div>

      {/* Cryptographic Tamper-Detection Invariant Box */}
      <div className="bg-slate-900 text-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              SHA-256 Tamper-Detection Fingerprint
            </h4>
          </div>

          <button
            onClick={handleCopyHash}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedHash ? 'Hash Copied' : 'Copy Hash'}
          </button>
        </div>

        <div className="mt-3 font-mono text-xs break-all bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 select-all">
          {cert.sha256_hash || 'SHA-256 fingerprint not recorded'}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div>
            Canonical Invariant: <span className="text-slate-200">ISO 1461 Specifications & Line Items</span>
          </div>
          <div className="sm:text-right">
            Integrity Check: <span className="text-emerald-400 font-semibold">{isAuthentic ? 'Cryptographically Genuine' : 'Failed Integrity Check'}</span>
          </div>
        </div>
      </div>

      {/* Inspector Audit & Demonstration Controls (Visible Only to Authenticated Staff) */}
      {isAuthenticated && (
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Staff QA/QC Evaluator Controls
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Simulate field inspection conditions or test the cryptographic tamper detection engine:
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTamperTest}
              className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Alters line item quantities to trigger immediate cryptographic hash failure"
            >
              Simulate Document Tampering (Test Hash Mismatch)
            </button>

            <button
              onClick={handleToggleRevoke}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
            >
              {isRevoked ? 'Reinstate Certificate' : 'Revoke Certificate (Test Status)'}
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 text-slate-500" />
              Reset to Original
            </button>

            <button
              onClick={() => onOpenPdf(cert)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
            >
              <Download className="w-3 h-3" />
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
