import React, { useEffect, useState } from 'react';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  QrCode,
  FileText,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import type { CertificateData } from '../types/certificate';
import { certificateRepository } from '../services/storage';

interface CertificateLedgerProps {
  onSelectCertificate: (certId: string) => void;
  onOpenPdf: (cert: CertificateData) => void;
  onOpenQr: (cert: CertificateData) => void;
  onCreateNew: () => void;
}

export const CertificateLedger: React.FC<CertificateLedgerProps> = ({
  onSelectCertificate,
  onOpenPdf,
  onOpenQr,
  onCreateNew,
}) => {
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUTHENTIC' | 'REVOKED'>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await certificateRepository.getAll();
      setCertificates(data);
    } catch (err) {
      console.error('Failed to load certificates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = certificates.filter((cert) => {
    const matchesSearch =
      cert.cert_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.line_items?.some((item) =>
        item.site_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (!matchesSearch) return false;

    if (statusFilter === 'AUTHENTIC') {
      return cert.status === 'AUTHENTIC_VERIFIED';
    }
    if (statusFilter === 'REVOKED') {
      return cert.status === 'REVOKED';
    }
    return true;
  });

  // Calculate Metrics
  const totalIssued = certificates.length;
  const authenticCount = certificates.filter((c) => c.status === 'AUTHENTIC_VERIFIED').length;
  const totalArticles = certificates.reduce(
    (acc, c) => acc + (c.line_items?.reduce((iAcc, item) => iAcc + item.quantity, 0) || 0),
    0
  );
  const uniqueSites = new Set(
    certificates.flatMap((c) => c.line_items?.map((item) => item.site_id) || [])
  ).size;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Issued Certificates
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalIssued}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            BS EN ISO 1461 Standard
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Authentic & Conforming
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
            {authenticCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tamper-proof SHA-256 sealed
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Inspected Articles
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalArticles}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Mounts, ladders, brackets & clamps
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Allocated Site IDs
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {uniqueSites} Sites
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ZUL033, RYD-502, QAS-091 ...
          </div>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Certificate #, Client, Site ID, or Description..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Filter buttons & CTA */}
        <div className="flex items-center gap-3">
          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setStatusFilter('AUTHENTIC')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                statusFilter === 'AUTHENTIC' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Authentic
            </button>
            <button
              onClick={() => setStatusFilter('REVOKED')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                statusFilter === 'REVOKED' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revoked
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Issue Certificate
          </button>
        </div>
      </div>

      {/* Main Certificates Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Certificate ID</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Client / Beneficiary</th>
                <th className="py-3 px-4">Allocated Sites</th>
                <th className="py-3 px-4 text-center">Articles</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading official inspection registry...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">No certificates match query</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search filters or generate a new certificate.</p>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((cert) => {
                  const isAuth = cert.status === 'AUTHENTIC_VERIFIED';
                  const sites = Array.from(new Set(cert.line_items?.map((i) => i.site_id) || []));

                  return (
                    <tr
                      key={cert.cert_id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => onSelectCertificate(cert.cert_id)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{cert.cert_id}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {cert.sha256_hash ? `${cert.sha256_hash.slice(0, 10)}...` : 'SHA-256'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {cert.issue_date}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{cert.client}</div>
                        <div className="text-[10px] text-slate-500 font-normal truncate max-w-xs">
                          {cert.project_name}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {sites.map((s, idx) => (
                            <span
                              key={idx}
                              className="font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 tabular-nums">
                        {cert.line_items?.length || 0}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-0.5 rounded-md ${
                            isAuth
                              ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                              : 'text-rose-800 bg-rose-50 border border-rose-200'
                          }`}
                        >
                          {isAuth ? <ShieldCheck className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-rose-600" />}
                          {isAuth ? 'AUTHENTIC' : 'REVOKED'}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenQr(cert)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Show Verification QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenPdf(cert)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Preview / Download Official PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onSelectCertificate(cert.cert_id)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            Verify
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
