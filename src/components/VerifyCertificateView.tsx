import React from 'react';
import { 
  ShieldCheck, 
  Download, 
  Calendar, 
  Building2, 
  Hash, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Clock,
  Printer
} from 'lucide-react';

interface LineItem {
  itemNo?: string | number;
  siteNo?: string;
  description?: string;
  qty?: string | number;
  unit?: string;
}

interface CertificateData {
  certRef: string;
  issueDate: string;
  clientName: string;
  projectName?: string;
  purchaseOrderNo?: string;
  deliveryNoteNo?: string;
  status?: string;
  items?: LineItem[];
}

export const VerifyCertificateView: React.FC<{
  certificate: CertificateData;
  onDownloadPDF?: () => void;
}> = ({ certificate, onDownloadPDF }) => {
  const isAuthentic = certificate.status !== 'REVOKED' && certificate.status !== 'TAMPERED';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 font-sans">
      {/* Verification Status Header */}
      <div className={`mb-8 p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-6 shadow-sm ${
        isAuthentic ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
      }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${
          isAuthentic ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {isAuthentic ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {isAuthentic ? 'Verification Successful' : 'Verification Failed'}
          </h1>
          <p className={`text-sm font-medium ${isAuthentic ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isAuthentic 
              ? 'This document is authentic and currently valid in the official MYMF QA/QC registry.' 
              : 'This certificate has been revoked or tampered with. Please contact quality control.'}
          </p>
        </div>
        <button
          onClick={onDownloadPDF}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Certificate Metadata */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                <FileText className="w-4 h-4 text-slate-500" />
                Certificate Overview
              </h2>
              <span className="text-xs font-mono font-bold text-slate-500">{certificate.certRef}</span>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Name</label>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-300" />
                  <p className="font-semibold text-slate-900">{certificate.clientName}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue Date</label>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-300" />
                  <p className="font-semibold text-slate-900">{certificate.issueDate}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Reference</label>
                <p className="font-medium text-slate-700">{certificate.projectName || '---'}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Purchase Order</label>
                <p className="font-mono text-xs font-semibold text-slate-900">{certificate.purchaseOrderNo || '---'}</p>
              </div>
            </div>
          </div>

          {/* QA/QC Specifications Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">QA/QC Specifications</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Site Reference</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {certificate.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-900 text-[11px] font-bold rounded border border-slate-200">
                          {item.siteNo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">{item.description}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                        {item.qty} <span className="text-[10px] font-medium text-slate-400 uppercase ml-1">{item.unit}</span>
                      </td>
                    </tr>
                  ))}
                  {(!certificate.items || certificate.items.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic text-sm">
                        No line items recorded for this certificate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Company Info */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
            <h3 className="text-lg font-bold mb-4 relative z-10">Issuer Metadata</h3>
            <div className="space-y-4 relative z-10">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Company Name</p>
                <p className="text-sm font-medium leading-snug">Mohammed Yehya Al-Aseery For Metal Industries</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CR Number</p>
                  <p className="text-sm font-mono font-bold">1010997047</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">VAT Number</p>
                  <p className="text-sm font-mono font-bold">302154658900006</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quality Standard</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-sm font-bold">BS EN ISO 1461:2022</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Printer className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Original Printed Copy?</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Verify that the physical certificate in your hand exactly matches the details and items shown here.
            </p>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="w-full h-full bg-slate-900" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">System Timestamp: {new Date().toISOString()}</span>
        </div>
        <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-medium">
          Official Digital Registry of Mohammed Yehya Al-Aseery Factory (MYMF)
        </p>
      </div>
    </div>
  );
};
