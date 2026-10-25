import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { certificateRepository } from '../services/storage';
import type { VerificationResult } from '../types/certificate';
import { VerifyCertificateView } from './VerifyCertificateView';
import { ShieldAlert, Loader2 } from 'lucide-react';

export const PublicVerificationWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCert = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await certificateRepository.verify(id);
        setResult(res);
      } catch (err) {
        console.error('Verification error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCert();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-slate-900 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Accessing Official Registry...</h2>
        <p className="text-sm text-slate-500 font-medium">Verifying cryptographic signature</p>
      </div>
    );
  }

  if (!result || !result.certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-xl p-10 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">Record Not Found</h2>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            The certificate reference <span className="font-mono text-slate-900 font-bold">{id}</span> does not exist in our official database.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:shadow-lg transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const cert = result.certificate;

  // Map Firestore/Repository data to VerifyCertificateView props
  const viewData = {
    certRef: cert.cert_id,
    issueDate: cert.issue_date,
    clientName: cert.client,
    projectName: cert.project_name,
    purchaseOrderNo: cert.purchase_order_no,
    deliveryNoteNo: cert.delivery_note_no,
    status: result.status,
    items: cert.line_items?.map(item => ({
      itemNo: item.item_no,
      siteNo: item.site_id,
      description: item.description,
      qty: item.quantity,
      unit: item.unit
    }))
  };

  const handleDownloadPDF = async () => {
    try {
      const pdfBytes = await certificateRepository.getPDF(cert.cert_id);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.cert_id}_Galv_Cert.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <VerifyCertificateView 
        certificate={viewData} 
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
};
