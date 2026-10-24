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
  FileSpreadsheet,
} from 'lucide-react';
import type { CertificateData } from '../types/certificate';
import { certificateRepository } from '../services/storage';

interface CertificateLedgerProps {
  onSelectCertificate: (certId: string) => void;
  onOpenPdf: (cert: CertificateData) => void;
  onOpenQr: (cert: CertificateData) => void;
  onCreateNew: () => void;
  onOpenBulk?: () => void;
}

export const CertificateLedger: React.FC<CertificateLedgerProps> = ({
  onSelectCertificate,
  onOpenPdf,
  onOpenQr,
  onCreateNew,
  onOpenBulk,
}) => {
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string>('ALL');
  const [filterClient, setFilterClient] = useState<string>('ALL');
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

  // Compute unique client / beneficiary list and site ID list for fast dropdowns
  const availableClients = Array.from(
    new Set(certificates.map((c) => c.client.trim()).filter(Boolean))
  ).sort();

  const availableSites = Array.from(
    new Set(
      certificates.flatMap((c) => c.line_items?.map((item) => item.site_id.trim()) || []).filter(Boolean)
    )
  ).sort();

  const filtered = certificates.filter((cert) => {
    // 1. General search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        cert.cert_id.toLowerCase().includes(q) ||
        cert.client.toLowerCase().includes(q) ||
        cert.project_name?.toLowerCase().includes(q) ||
        cert.purchase_order_no?.toLowerCase().includes(q) ||
        cert.line_items?.some(
          (item) =>
            item.site_id.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.heat_number?.toLowerCase().includes(q)
        );
      if (!matchesSearch) return false;
    }

    // 2. Filter by Site ID
    if (filterSiteId && filterSiteId !== 'ALL') {
      const matchesSite = cert.line_items?.some(
        (item) => item.site_id.toLowerCase() === filterSiteId.toLowerCase()
      );
      if (!matchesSite) return false;
    }

    // 3. Filter by Client / Beneficiary
    if (filterClient && filterClient !== 'ALL') {
      const matchesClient = cert.client.toLowerCase() === filterClient.toLowerCase();
      if (!matchesClient) return false;
    }

    // 4. Status filter
    if (statusFilter === 'AUTHENTIC') {
      return cert.status === 'AUTHENTIC_VERIFIED';
    }
    if (statusFilter === 'REVOKED') {
      return cert.status === 'REVOKED';
    }
    return true;
  });

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filterSiteId !== 'ALL' ||
    filterClient !== 'ALL' ||
    statusFilter !== 'ALL';

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterSiteId('ALL');
    setFilterClient('ALL');
    setStatusFilter('ALL');
  };

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

      {/* Action & Filter Toolbar with Multi-attribute Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        {/* Top Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* General Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference, description..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Filter by Site ID */}
          <div className="relative">
            <select
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="ALL">All Site IDs ({availableSites.length})</option>
              {availableSites.map((site) => (
                <option key={site} value={site}>
                  Site: {site}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Client / Beneficiary */}
          <div className="relative">
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="ALL">All Clients / Beneficiaries ({availableClients.length})</option>
              {availableClients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status & Action */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`flex-1 py-1.5 rounded-md text-center cursor-pointer transition-colors ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('AUTHENTIC')}
                className={`flex-1 py-1.5 rounded-md text-center cursor-pointer transition-colors ${
                  statusFilter === 'AUTHENTIC' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Authentic
              </button>
              <button
                onClick={() => setStatusFilter('REVOKED')}
                className={`flex-1 py-1.5 rounded-md text-center cursor-pointer transition-colors ${
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
          </div>
        </div>

        {/* Action Buttons & Filter Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>
              Showing <strong className="font-semibold text-slate-900">{filtered.length}</strong> of{' '}
              <strong className="font-semibold text-slate-900">{totalIssued}</strong> certificates
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="ml-2 text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenBulk && (
              <button
                onClick={onOpenBulk}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                title="Bulk create certificates from Excel sheet and download as ZIP"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bulk Excel (50+ Sites)</span>
              </button>
            )}

            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Issue Single
            </button>
          </div>
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
                <th className="py-3 px-4">Audit Trail</th>
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

                      <td className="py-3.5 px-4">
                        <div className="text-[10px] text-slate-500 font-mono">
                          {cert.audit_trail ? (
                             <div className="space-y-0.5">
                              <div>IP: {cert.audit_trail.issuance_ip}</div>
                              <div className="truncate max-w-[120px]" title={cert.audit_trail.location}>
                                Loc: {cert.audit_trail.location}
                              </div>
                              <div className="truncate max-w-[120px]">
                                Hash: {cert.sha256_hash ? cert.sha256_hash.slice(0, 8) : 'N/A'}
                              </div>
                              <div className="truncate max-w-[120px]">
                                Time: {cert.audit_trail.issued_at ? new Date(cert.audit_trail.issued_at).toLocaleTimeString() : 'N/A'}
                              </div>
                             </div>
                          ) : 'N/A'}
                        </div>
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
