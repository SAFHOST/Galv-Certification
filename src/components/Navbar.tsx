import React from 'react';
import { ShieldCheck, Plus, LogOut, Lock, UserCheck } from 'lucide-react';
import type { AuthUser } from '../services/auth';

export type ActiveTab = 'ledger' | 'generate' | 'bulk' | 'verify' | 'architecture' | 'login';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewCertificate: () => void;
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  isPublicVerificationMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onNewCertificate,
  isAuthenticated,
  currentUser,
  onLogout,
  onOpenLogin,
  isPublicVerificationMode,
}) => {
  // If viewing public QR verification, hide all internal engineering tabs
  if (isPublicVerificationMode) {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-8 h-16">
            {/* Zone 1: Brand title */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                  MYMF Verification Portal
                </div>
                <div className="text-[11px] text-slate-500 font-mono tracking-tight whitespace-nowrap">
                  BS EN ISO 1461 Standard System
                </div>
              </div>
            </div>

            {/* Zone 2: Public Badge (no internal tabs) */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Official Public Inspection Verifier</span>
            </div>

            {/* Zone 3: Staff portal access */}
            <div className="flex items-center gap-3 shrink-0">
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectTab('ledger')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    <span>Staff Console</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  title="Authorized QA/QC Staff Login"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Staff Portal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Internal Management Console (Shown only when authenticated or logging in)
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <button
              onClick={() => onSelectTab('ledger')}
              className="text-left cursor-pointer focus:outline-hidden"
            >
              <div className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                MYMF QA/QC Console
              </div>
              <div className="text-[11px] text-slate-500 font-mono tracking-tight whitespace-nowrap">
                Internal Engineering System
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links for authenticated staff */}
          {isAuthenticated ? (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                onClick={() => onSelectTab('ledger')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'ledger' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 py-5 -mb-[2px]' : ''
                }`}
              >
                Inspection Ledger
              </button>
              <button
                onClick={() => onSelectTab('generate')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'generate' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 py-5 -mb-[2px]' : ''
                }`}
              >
                Generate Single
              </button>
              <button
                onClick={() => onSelectTab('bulk')}
                className={`inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'bulk' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 py-5 -mb-[2px]' : ''
                }`}
              >
                <span>Bulk Excel (50+ Sites)</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">ZIP</span>
              </button>
              <button
                onClick={() => onSelectTab('verify')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'verify' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 py-5 -mb-[2px]' : ''
                }`}
              >
                Certificate Preview
              </button>
              <button
                onClick={() => onSelectTab('architecture')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'architecture' ? 'text-slate-900 font-semibold border-b-2 border-slate-900 py-5 -mb-[2px]' : ''
                }`}
              >
                System Architecture
              </button>
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Authentication required to access QA/QC tools</span>
            </div>
          )}

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <>
                <button
                  onClick={onNewCertificate}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Issue Certificate</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-900 leading-tight">
                      {currentUser?.name || 'Adel Y. Aseery'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Quality Head</div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectTab('verify')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Public Verifier</span>
                </button>
                <button
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile secondary navigation strip for authenticated staff */}
        {isAuthenticated && (
          <div className="flex md:hidden items-center gap-4 py-2 border-t border-slate-100 overflow-x-auto text-xs font-medium text-slate-600 no-scrollbar">
            <button
              onClick={() => onSelectTab('ledger')}
              className={`whitespace-nowrap shrink-0 py-1 ${activeTab === 'ledger' ? 'text-slate-900 font-bold' : ''}`}
            >
              Inspection Ledger
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onSelectTab('generate')}
              className={`whitespace-nowrap shrink-0 py-1 ${activeTab === 'generate' ? 'text-slate-900 font-bold' : ''}`}
            >
              Generate Single
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onSelectTab('bulk')}
              className={`whitespace-nowrap shrink-0 py-1 ${activeTab === 'bulk' ? 'text-slate-900 font-bold' : ''}`}
            >
              Bulk Excel (ZIP)
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onSelectTab('architecture')}
              className={`whitespace-nowrap shrink-0 py-1 ${activeTab === 'architecture' ? 'text-slate-900 font-bold' : ''}`}
            >
              Architecture
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={onLogout}
              className="whitespace-nowrap shrink-0 py-1 text-rose-600"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
