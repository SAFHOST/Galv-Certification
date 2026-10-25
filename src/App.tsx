import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { CertificateData } from './types/certificate';
import { authService, type AuthUser } from './services/auth';
import { Navbar, type ActiveTab } from './components/Navbar';
import { CertificateLedger } from './components/CertificateLedger';
import { CertificateGenerator } from './components/CertificateGenerator';
import { BulkCertificateGenerator } from './components/BulkCertificateGenerator';
import { StaffLogin } from './components/StaffLogin';
import { QRScannerModal } from './components/QRScannerModal';
import { QRDisplayModal } from './components/QRDisplayModal';
import { PDFPreviewModal } from './components/PDFPreviewModal';
import { CompanyLandingPage } from './components/CompanyLandingPage';
import { PublicVerificationWrapper } from './components/PublicVerificationWrapper';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';

// Wrapper to provide auth context and layout to the console
const ConsoleLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => authService.isAuthenticated());
  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const navigate = useNavigate();

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [modalCert, setModalCert] = useState<CertificateData | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authService.subscribe((user) => {
      setCurrentUser(user);
      setIsAuthenticated(Boolean(user));
    });
    return unsubscribe;
  }, []);

  if (!isAuthenticated) {
    return (
      <StaffLogin 
        onSuccess={() => setIsAuthenticated(true)}
        onNavigateToVerify={(id) => navigate(`/verify/${id}`)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onCancel={() => navigate('/')}
      />
    );
  }

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const handleOpenPdf = (cert: CertificateData) => {
    setModalCert(cert);
    setIsPdfModalOpen(true);
  };

  const handleOpenQr = (cert: CertificateData) => {
    setModalCert(cert);
    setIsQrModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewCertificate={() => setActiveTab('generate')}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => {}}
        isPublicVerificationMode={false}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'ledger' && (
          <CertificateLedger
            onSelectCertificate={(id) => navigate(`/verify/${id}`)}
            onOpenPdf={handleOpenPdf}
            onOpenQr={handleOpenQr}
            onCreateNew={() => setActiveTab('generate')}
            onOpenBulk={() => setActiveTab('bulk')}
          />
        )}
        {activeTab === 'generate' && (
          <CertificateGenerator
            onCertificateCreated={(newId) => {
              navigate(`/verify/${newId}`);
            }}
            onPreviewPDF={handleOpenPdf}
          />
        )}
        {activeTab === 'bulk' && (
          <BulkCertificateGenerator
            onSuccessViewLedger={() => setActiveTab('ledger')}
            onSelectCertificate={(id) => navigate(`/verify/${id}`)}
            onPreviewPDF={handleOpenPdf}
          />
        )}
        {activeTab === 'architecture' && <ArchitectureDiagram />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest">
          <div>Mohammed Yehya Al-Aseery For Metal Industries (MYMF) • CR: 1010997047 • VAT: 302154658900006</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>BS EN ISO 1461 Standard</span>
            <span>·</span>
            <span>Riyadh, KSA</span>
          </div>
        </div>
      </footer>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={(id) => navigate(`/verify/${id}`)}
      />

      <QRDisplayModal
        certificate={modalCert}
        qrDataUrl={modalQrUrl}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onOpenVerification={(id) => navigate(`/verify/${id}`)}
      />

      <PDFPreviewModal
        certificate={modalCert}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const navigate = useNavigate();

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <CompanyLandingPage 
            onNavigateToPortal={() => navigate('/console')} 
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        } />
        <Route path="/verify/:id" element={<PublicVerificationWrapper />} />
        
        {/* Admin/Console Routes */}
        <Route path="/console" element={<ConsoleLayout children={null} />} />
        <Route path="/admin" element={<Navigate to="/console" replace />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={(id) => {
          setIsScannerOpen(false);
          navigate(`/verify/${id}`);
        }}
      />
    </>
  );
}
