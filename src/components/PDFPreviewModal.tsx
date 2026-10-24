import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Printer, ShieldCheck } from 'lucide-react';
import type { CertificateData } from '../types/certificate';
import { certificateRepository } from '../services/storage';

interface PDFPreviewModalProps {
  certificate: CertificateData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ certificate, isOpen, onClose }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !certificate) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const response = await fetch(`/api/certificates/${encodeURIComponent(certificate.cert_id)}/pdf`);
        
        if (!response.ok) {
          let msg = 'Failed to load PDF';
          try {
            const errJson = await response.json();
            if (errJson.error) msg = errJson.error;
          } catch {
            try {
              const errText = await response.text();
              if (errText.includes('<!DOCTYPE html>')) msg = 'Server error during PDF generation. Please check logs.';
              else if (errText) msg = errText;
            } catch {}
          }
          throw new Error(msg);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());

        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (isMounted) {
          setPdfBlobUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed generating PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [isOpen, certificate]);

  if (!isOpen || !certificate) return null;

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = `${certificate.cert_id.replace(/[^a-zA-Z0-9-_]/g, '_')}_MYMF_Cert.pdf`;
    a.click();
  };

  const handlePrint = () => {
    if (!pdfBlobUrl) return;
    const win = window.open(pdfBlobUrl, '_blank');
    if (win) {
      win.focus();
      win.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 font-mono">{certificate.cert_id}</span>
                <span className="text-xs text-slate-500">· Official BS EN ISO 1461 Document</span>
              </div>
              <div className="text-xs text-slate-500 truncate max-w-md">
                {certificate.client} • {certificate.issue_date}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Download compiled PDF binary"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            {pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                New Tab
              </a>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewport */}
        <div className="flex-1 bg-slate-200/60 p-2 sm:p-4 flex items-center justify-center overflow-auto">
          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-xs font-semibold text-slate-700">Rendering high-resolution PDF in-memory...</div>
              <div className="text-[11px] text-slate-500 mt-1">Embedding dynamic QR code & QA/QC stamps</div>
            </div>
          )}

          {error && (
            <div className="text-center p-8 bg-white rounded-xl border border-red-200 max-w-md">
              <div className="text-sm font-semibold text-red-700 mb-1">Failed to generate PDF</div>
              <div className="text-xs text-red-500">{error}</div>
            </div>
          )}

          {!loading && !error && pdfBlobUrl && (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-lg shadow-sm border border-slate-300 bg-white"
              title={`PDF Preview ${certificate.cert_id}`}
            />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>SHA-256 Digest:</span>
            <span className="font-mono text-[11px] text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {certificate.sha256_hash ? certificate.sha256_hash.slice(0, 24) + '...' : 'Generating...'}
            </span>
          </div>
          <div className="text-slate-500 text-[11px]">
            In-Memory Compiled • Direct Stream (No Temp Disk Files)
          </div>
        </div>
      </div>
    </div>
  );
};
