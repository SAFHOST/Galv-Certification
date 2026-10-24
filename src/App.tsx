import React, { useEffect, useState } from 'react';
import type { CertificateData } from './types/certificate';
import QRCode from 'qrcode';
import { authService, type AuthUser } from './services/auth';
import { Navbar, type ActiveTab } from './components/Navbar';
import { CertificateLedger } from './components/CertificateLedger';
import { CertificateGenerator } from './components/CertificateGenerator';
import { BulkCertificateGenerator } from './components/BulkCertificateGenerator';
import { VerificationPortal } from './components/VerificationPortal';
import { StaffLogin } from './components/StaffLogin';
import { QRScannerModal } from './components/QRScannerModal';
import { QRDisplayModal } from './components/QRDisplayModal';
import { PDFPreviewModal } from './components/PDFPreviewModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => authService.isAuthenticated());

  // Navigation & View state - Default to Login UI on landing
  const [activeTab, setActiveTab] = useState<ActiveTab>('login');
  const [selectedCertId, setSelectedCertId] = useState<string>('MYF-QC-26-239');
  const [isPublicVerificationMode, setIsPublicVerificationMode] = useState<boolean>(false);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const [modalCert, setModalCert] = useState<CertificateData | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.subscribe((user) => {
      setCurrentUser(user);
      setIsAuthenticated(Boolean(user));
    });
    return unsubscribe;
  }, []);

  // Check URL pathname for direct verification routing (e.g. /verify/MYF-QC-26-239)
  useEffect(() => {
    const handleUrlRoute = () => {
      const path = window.location.pathname;
      if (path.startsWith('/verify/')) {
        const rawId = path.replace('/verify/', '').trim();
        if (rawId) {
          const decoded = decodeURIComponent(rawId);
          setSelectedCertId(decoded);
          setActiveTab('verify');
          setIsPublicVerificationMode(true);
        }
      } else {
        // If visiting root URL: if authenticated, go to ledger, otherwise land on Login UI
        if (authService.isAuthenticated()) {
          setIsPublicVerificationMode(false);
          setActiveTab('ledger');
        } else {
          setIsPublicVerificationMode(false);
          setActiveTab('login');
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  const navigateToTab = (tab: ActiveTab) => {
    if (tab === 'login') {
      setIsPublicVerificationMode(false);
      setActiveTab('login');
      return;
    }

    if (tab === 'verify') {
      setIsPublicVerificationMode(true);
      setActiveTab('verify');
      return;
    }

    // Protect internal tools behind auth
    if ((tab === 'ledger' || tab === 'generate' || tab === 'bulk' || tab === 'architecture') && !isAuthenticated) {
      setIsPublicVerificationMode(false);
      setActiveTab('login');
      return;
    }

    setIsPublicVerificationMode(false);
    setActiveTab(tab);
    if (window.location.pathname.startsWith('/verify/')) {
      window.history.pushState({}, '', '/');
    }
  };

  const handleOpenVerification = (certId: string) => {
    setSelectedCertId(certId);
    setActiveTab('verify');
    setIsPublicVerificationMode(true);
    window.history.pushState({}, '', `/verify/${encodeURIComponent(certId)}`);
  };

  const handleOpenPdf = (cert: CertificateData) => {
    setModalCert(cert);
    setIsPdfModalOpen(true);
  };

  const handleOpenQr = async (cert: CertificateData) => {
    setModalCert(cert);
    try {
      const currentOrigin = window.location.origin;
      const verificationUrl = `${currentOrigin}/verify/${encodeURIComponent(cert.cert_id)}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 0, width: 280 });
      setModalQrUrl(qrDataUrl);
    } catch {
      setModalQrUrl(null);
    }
    setIsQrModalOpen(true);
  };

  const handleQrScanned = (scannedId: string) => {
    handleOpenVerification(scannedId);
  };

  const handleLoginSuccess = () => {
    setIsPublicVerificationMode(false);
    setActiveTab('ledger');
  };

  const handleLogout = () => {
    authService.logout();
    setIsPublicVerificationMode(false);
    setActiveTab('login');
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={navigateToTab}
        onNewCertificate={() => navigateToTab('generate')}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => navigateToTab('login')}
        isPublicVerificationMode={isPublicVerificationMode}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {/* PUBLIC FIELD VERIFICATION ROUTE - Only shows specific certificate data */}
        {activeTab === 'verify' && (
          <VerificationPortal
            certId={selectedCertId}
            onOpenPdf={handleOpenPdf}
            onOpenQR={handleOpenQr}
            isAuthenticated={isAuthenticated}
            onSearchOther={
              isAuthenticated
                ? () => navigateToTab('ledger')
                : () => setIsScannerOpen(true)
            }
          />
        )}

        {/* STAFF LOGIN VIEW */}
        {activeTab === 'login' && !isAuthenticated && (
          <StaffLogin
            onSuccess={handleLoginSuccess}
            onNavigateToVerify={handleOpenVerification}
            onOpenScanner={() => setIsScannerOpen(true)}
            onCancel={() => {
              handleOpenVerification(selectedCertId || 'MYF-QC-26-239');
            }}
          />
        )}

        {/* AUTH-PROTECTED INTERNAL QA/QC CONSOLE */}
        {isAuthenticated && !isPublicVerificationMode && (
          <>
            {activeTab === 'ledger' && (
              <CertificateLedger
                onSelectCertificate={handleOpenVerification}
                onOpenPdf={handleOpenPdf}
                onOpenQr={handleOpenQr}
                onCreateNew={() => navigateToTab('generate')}
                onOpenBulk={() => navigateToTab('bulk')}
              />
            )}

            {activeTab === 'generate' && (
              <CertificateGenerator
                onCertificateCreated={(newId) => {
                  handleOpenVerification(newId);
                }}
                onPreviewPDF={handleOpenPdf}
              />
            )}

            {activeTab === 'bulk' && (
              <BulkCertificateGenerator
                onSuccessViewLedger={() => navigateToTab('ledger')}
                onSelectCertificate={handleOpenVerification}
                onPreviewPDF={handleOpenPdf}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Mohammed Yehya Al-Aseery For Metal Industries (MYMF) • CR: 1010997047 • VAT: 302154658900006
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>BS EN ISO 1461 Standard</span>
            <span>·</span>
            <span>PO Box 370372, Riyadh 11325, KSA</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={handleQrScanned}
      />

      <QRDisplayModal
        certificate={modalCert}
        qrDataUrl={modalQrUrl}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onOpenVerification={handleOpenVerification}
      />

      <PDFPreviewModal
        certificate={modalCert}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
}
