import React, { useState } from 'react';
import { X, Copy, Check, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import type { CertificateData } from '../types/certificate';

interface QRDisplayModalProps {
  certificate: CertificateData | null;
  qrDataUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVerification: (certId: string) => void;
}

export const QRDisplayModal: React.FC<QRDisplayModalProps> = ({
  certificate,
  qrDataUrl,
  isOpen,
  onClose,
  onOpenVerification,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !certificate) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const verificationUrl = `${currentOrigin}/verify/${encodeURIComponent(certificate.cert_id)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${certificate.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Verification QR Code</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Body */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs mb-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${certificate.cert_id}`}
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          <div className="text-sm font-bold font-mono text-slate-900 mb-1">
            {certificate.cert_id}
          </div>
          <div className="text-xs text-slate-500 mb-4">
            {certificate.client} • {certificate.issue_date}
          </div>

          {/* Verification Target URL Box */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4 text-left">
            <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Target Verification Endpoint</div>
            <div className="text-xs font-mono text-slate-700 truncate select-all">{verificationUrl}</div>
          </div>

          {/* Action buttons */}
          <div className="w-full grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>

            <button
              onClick={handleDownloadQR}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Download PNG
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenVerification(certificate.cert_id);
            }}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Field Verification View
          </button>
        </div>
      </div>
    </div>
  );
};
