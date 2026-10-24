import React from 'react';
import { ArrowRight, ShieldCheck, FileText, Search } from 'lucide-react';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToVerify: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin, onNavigateToVerify }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold text-slate-900 mb-6">
        MYMF QA/QC Verification Engine
      </h1>
      <p className="text-xl text-slate-600 mb-12">
        Secure, authenticated hot-dip galvanization certification and verification.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Staff Access</h2>
          <p className="text-slate-600 mb-6">Manage certificates, run bulk operations, and view audit trails.</p>
          <button onClick={onNavigateToLogin} className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer">
            Login to Console <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <Search className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Public Verification</h2>
          <p className="text-slate-600 mb-6">Verify any certificate by its ID or QR code.</p>
          <button onClick={onNavigateToVerify} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer">
            Verify Certificate <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
