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
            src="/assets/aistudio/image_576b524e.png"
            alt="MYMF Logo"
            className="h-16 mx-auto mb-2 object-contain"
          />
          <h2 className="text-base font-bold text-slate-900">
            MYMF Engineering Portal
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mohammed Yehya Al-Aseery For Metal Industries (MYMF) is a leading provider of high-quality hot-dip galvanization services, committed to excellence and BS EN ISO 1461 standards.
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
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </form>
      </div>

      {/* Public Customer / Auditor Quick Verification Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Certificate Verification</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Verify authentic galvanization certificates by entering the reference number or using our QR scanner:
        </p>

        <form onSubmit={handleDirectSearch} className="flex gap-2">
          <input
            type="text"
            value={searchCertId}
            onChange={(e) => setSearchCertId(e.target.value)}
            placeholder="Reference Number"
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Verify
          </button>
        </form>

        {onOpenScanner && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onOpenScanner}
              className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer text-[11px]"
            >
              Scan QR via Camera →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
