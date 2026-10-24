import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle, KeyRound, Check } from 'lucide-react';
import { authService, DEFAULT_CREDENTIALS } from '../services/auth';

interface StaffLoginProps {
  onSuccess: () => void;
  onCancel?: () => void;
  onNavigateToVerify?: (certId: string) => void;
  onOpenScanner?: () => void;
}

export const StaffLogin: React.FC<StaffLoginProps> = ({
  onSuccess,
  onCancel,
  onNavigateToVerify,
  onOpenScanner,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [searchCertId, setSearchCertId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const success = authService.login(username, password);
    if (success) {
      onSuccess();
    } else {
      setError('Invalid username or password. Please use authorized QA/QC credentials.');
    }
  };

  const handleFillDefaults = () => {
    setUsername(DEFAULT_CREDENTIALS.username);
    setPassword(DEFAULT_CREDENTIALS.password);
    setError(null);
    setFilled(true);
    setTimeout(() => setFilled(false), 2000);
  };

  const handleDirectSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCertId.trim();
    if (clean && onNavigateToVerify) {
      onNavigateToVerify(clean);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header with MYMF Branding */}
        <div className="p-6 text-center border-b border-slate-100 bg-slate-50">
          <img
            src="/assets/template/mymf_logo.jpg"
            alt="MYMF Logo"
            className="h-16 mx-auto mb-2 object-contain"
          />
          <h2 className="text-base font-bold text-slate-900">
            QA/QC Internal Engineering Portal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mohammed Yehya Al-Aseery For Metal Industries • Authorized Personnel Sign In
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Staff Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin or qa@mymf.com.sa"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign In to QA/QC Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Default Credentials Quick Helper */}
          <div className="pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  Default QA/QC Staff Credentials:
                </span>
                <button
                  type="button"
                  onClick={handleFillDefaults}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1"
                >
                  {filled ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                  {filled ? 'Credentials Filled' : '1-Click Autofill'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
                <div>User: <strong className="text-slate-900">admin</strong></div>
                <div>Pass: <strong className="text-slate-900">password123</strong></div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Public Customer / Auditor Quick Verification Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Public Customer Certificate Verification</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Verify genuine BS EN ISO 1461 hot-dip galvanization certificate by reference number or physical QR code:
        </p>

        <form onSubmit={handleDirectSearch} className="flex gap-2">
          <input
            type="text"
            value={searchCertId}
            onChange={(e) => setSearchCertId(e.target.value)}
            placeholder="e.g. MYF-QC-26-239"
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Verify
          </button>
        </form>

        <div className="flex items-center justify-between pt-1 text-[11px]">
          <button
            type="button"
            onClick={() => onNavigateToVerify && onNavigateToVerify('MYF-QC-26-239')}
            className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
          >
            Quick View: MYF-QC-26-239
          </button>
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
            >
              Scan QR via Camera →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
