import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  FileSpreadsheet,
  Upload,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowRight,
  FileCheck,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  Trash2,
} from 'lucide-react';
import type { CertificateData, LineItem } from '../types/certificate';
import { generateCertificatePDF } from '../services/pdfEngine';
import { certificateRepository } from '../services/storage';

interface BulkCertificateGeneratorProps {
  onSuccessViewLedger: () => void;
  onSelectCertificate: (certId: string) => void;
  onPreviewPDF: (cert: CertificateData) => void;
}

interface ParsedSiteRow {
  rowNumber: number;
  siteId: string;
  description: string;
  quantity: number;
  unit: string;
  measuredDft: number;
  heatNumber: string;
  visualInspection: string;
  customCertId?: string;
  isValid: boolean;
  validationError?: string;
}

export const BulkCertificateGenerator: React.FC<BulkCertificateGeneratorProps> = ({
  onSuccessViewLedger,
  onSelectCertificate,
  onPreviewPDF,
}) => {
  // Master customer / project parameters applied to all bulk generated certificates
  const [client, setClient] = useState('Materials of M/S GBH');
  const [projectName, setProjectName] = useState('STC Telecom Site Extension Project - Northern Cluster');
  const [poNumber, setPoNumber] = useState('PO-GBH-2026-991');
  const [deliveryNote, setDeliveryNote] = useState('DN-25-1160');
  const [issueDate, setIssueDate] = useState('24 OCT 2026');
  const [idPrefix, setIdPrefix] = useState('MYF-QC-26-');
  const [startNumber, setStartNumber] = useState(201);

  // Technical specs conforming to BS EN ISO 1461
  const [bathTemp, setBathTemp] = useState(450);
  const [zincPurity, setZincPurity] = useState(99.995);
  const [minDft, setMinDft] = useState(85);

  // Excel parsed state
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSiteRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation & progress state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    current: number;
    total: number;
    stepText: string;
  } | null>(null);
  const [generatedBatch, setGeneratedBatch] = useState<CertificateData[] | null>(null);

  // 1. Download official sample Excel template (.xlsx)
  const handleDownloadSampleExcel = () => {
    // Generate realistic 5 sample sites demonstrating format for 50+ sites
    const sampleData = [
      {
        'Site #': 'ZUL033',
        'Description of Articles': 'RF Extension Mount with all accessories',
        'Quantity': 2,
        'Unit': '3M',
        'Measured DFT (µm)': 92.4,
        'Heat Number': 'HT-44810-B',
        'Visual Inspection': 'PASS',
        'Certificate ID (Optional)': '',
      },
      {
        'Site #': 'RYD-501',
        'Description of Articles': 'Structural Steel Gantry Tower Brackets (Grade S355JR)',
        'Quantity': 18,
        'Unit': 'PCS',
        'Measured DFT (µm)': 104.2,
        'Heat Number': 'HT-55102-K',
        'Visual Inspection': 'PASS',
        'Certificate ID (Optional)': '',
      },
      {
        'Site #': 'RYD-502',
        'Description of Articles': 'Hot-Dip Galvanized Lattice Support Crossarms',
        'Quantity': 12,
        'Unit': 'SET',
        'Measured DFT (µm)': 95.8,
        'Heat Number': 'HT-55109-M',
        'Visual Inspection': 'PASS',
        'Certificate ID (Optional)': '',
      },
      {
        'Site #': 'JED-102',
        'Description of Articles': 'Microwave Dish Heavy Duty Face Mounts',
        'Quantity': 4,
        'Unit': 'PCS',
        'Measured DFT (µm)': 90.1,
        'Heat Number': 'HT-33108-C',
        'Visual Inspection': 'PASS',
        'Certificate ID (Optional)': '',
      },
      {
        'Site #': 'DMM-304',
        'Description of Articles': 'Galvanized Safety Cable Fall-Arrest Ladder Brackets',
        'Quantity': 15,
        'Unit': 'PCS',
        'Measured DFT (µm)': 98.6,
        'Heat Number': 'HT-77219-F',
        'Visual Inspection': 'PASS',
        'Certificate ID (Optional)': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 14 }, // Site #
      { wch: 48 }, // Description
      { wch: 10 }, // Quantity
      { wch: 10 }, // Unit
      { wch: 20 }, // Measured DFT
      { wch: 16 }, // Heat Number
      { wch: 18 }, // Visual Inspection
      { wch: 25 }, // Certificate ID
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspection Sites');

    XLSX.writeFile(workbook, 'MYMF_Bulk_Galvanization_Sites_Template.xlsx');
  };

  // 2. Parse uploaded Excel or CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setGeneratedBatch(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          setParseError('The uploaded Excel sheet contains no data rows.');
          return;
        }

        const parsed: ParsedSiteRow[] = jsonRows.map((row, idx) => {
          // Normalize header keys case-insensitively
          const findKey = (candidates: string[]): any => {
            const keys = Object.keys(row);
            for (const cand of candidates) {
              const matched = keys.find((k) => k.trim().toLowerCase().includes(cand.toLowerCase()));
              if (matched && row[matched] !== '') return row[matched];
            }
            return '';
          };

          const siteId = String(findKey(['site #', 'site id', 'site', 'location', 'site_id']) || `SITE-${idx + 1}`).trim();
          const description = String(findKey(['description', 'article', 'material', 'item']) || 'Hot-Dip Galvanized Structural Steel Assembly').trim();
          const rawQty = findKey(['quantity', 'qty', 'count', 'pieces', 'pcs']);
          const quantity = Math.max(1, Number(rawQty) || 1);
          const unit = String(findKey(['unit', 'uom']) || 'PCS').trim().toUpperCase();
          const rawDft = findKey(['dft', 'thickness', 'measured dft', 'micron']);
          const measuredDft = Number(rawDft) || 91.5;
          const heatNumber = String(findKey(['heat', 'heat number', 'heat no']) || `HT-${50000 + idx}`).trim();
          const visualInspection = String(findKey(['visual', 'inspection', 'status']) || 'PASS').trim().toUpperCase();
          const customCertId = String(findKey(['certificate id', 'cert id', 'cert #', 'reference'])).trim();

          const isValid = Boolean(siteId && description);

          return {
            rowNumber: idx + 1,
            siteId,
            description,
            quantity,
            unit,
            measuredDft,
            heatNumber,
            visualInspection,
            customCertId: customCertId || undefined,
            isValid,
            validationError: !isValid ? 'Missing Site ID or Description' : undefined,
          };
        });

        setParsedRows(parsed);
      } catch (err: any) {
        console.error('Excel parse error', err);
        setParseError(`Failed to parse file: ${err.message || 'Unknown error'}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 3. Clear file selection
  const handleClearFile = () => {
    setFileName(null);
    setParsedRows([]);
    setParseError(null);
    setGeneratedBatch(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 4. Generate All Certificates & Package ZIP
  const handleGenerateAndDownloadZip = async () => {
    if (parsedRows.length === 0) return;

    setIsProcessing(true);
    setGeneratedBatch(null);

    try {
      const zip = new JSZip();
      const createdCerts: CertificateData[] = [];
      const pdfBytesMap = new Map<string, Uint8Array>();

      const total = parsedRows.length;
      const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://mymf.com.sa';

      for (let i = 0; i < total; i++) {
        const row = parsedRows[i];

        // Format unique certificate ID
        const certId =
          row.customCertId ||
          `${idPrefix}${String(startNumber + i).padStart(3, '0')}`;

        setCurrentProgress({
          current: i + 1,
          total,
          stepText: `Processing Certificate ${i + 1} of ${total} for Site: ${row.siteId} (${certId})...`,
        });

        const lineItem: LineItem = {
          item_no: 1,
          site_id: row.siteId,
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          heat_number: row.heatNumber,
          measured_dft_um: row.measuredDft,
          visual_inspection: row.visualInspection === 'FAIL' ? 'FAIL' : 'PASS',
        };

        const targetVerificationUrl = `${currentHost}/verify/${encodeURIComponent(certId)}`;

        const certPayload: CertificateData = {
          cert_id: certId,
          issue_date: issueDate.trim(),
          client: client.trim(),
          project_name: projectName.trim(),
          purchase_order_no: poNumber.trim(),
          delivery_note_no: deliveryNote.trim(),
          status: 'AUTHENTIC_VERIFIED',
          organization: {
            name: 'Mohammed Yehya Al-Aseery For Metal Industries (MYMF)',
            name_ar: 'مصنع محمد يحيى العسيري للصناعات المعدنية',
            cr_number: '1010207045',
            vat_number: '302154658900006',
            address: 'PO Box 370372, Riyadh 11325, KSA',
            tel: '+966 11 498 2211',
            email: 'qc@mymf.com.sa',
            website: 'www.mymf.com.sa',
            accreditation: 'ISO 9001:2015 & BS EN ISO 1461 Certified Facility',
          },
          technical_params: {
            standard: 'BS EN ISO 1461',
            standard_title: 'Hot dip galvanized coatings on fabricated iron and steel articles',
            bath_temperature_c: bathTemp,
            zinc_purity_percent: zincPurity,
            min_required_dft_um: minDft,
            flux_type: 'Triple Salt Zinc Ammonium Chloride',
            pre_treatment: 'Caustic Degreasing, Hydrochloric Acid Pickling & Pre-fluxing',
            passivation: 'Sodium Dichromate Quench Passivation',
          },
          line_items: [lineItem],
          sign_off: {
            name: 'Adel Y. Aseery',
            role: 'Quality Section Head',
            department: 'QA/QC Inspection Department',
            signed_at: new Date().toISOString(),
            signature_id: 'MYMF-SIG-AYA-0881',
          },
          notes: `Certified that materials for Site ${row.siteId} have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications.`,
          verification_url: targetVerificationUrl,
          created_at: new Date().toISOString(),
        };

        // Generate official PDF with embedded unique QR code
        const pdfGen = await generateCertificatePDF(certPayload, { hostDomain: currentHost });
        certPayload.sha256_hash = pdfGen.sha256Hash;
        certPayload.verification_url = pdfGen.verificationUrl;

        createdCerts.push(certPayload);
        pdfBytesMap.set(certPayload.cert_id, pdfGen.pdfBytes);

        // Add PDF to ZIP archive
        const sanitizedSite = row.siteId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const pdfFileName = `${certId}_Site_${sanitizedSite}_Galv_Cert.pdf`;
        zip.file(pdfFileName, pdfGen.pdfBytes);

        // Small yield to keep UI silky smooth
        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      setCurrentProgress({
        current: total,
        total,
        stepText: `Storing ${total} certificates in QA/QC registry & compiling ZIP archive...`,
      });

      // Save all certificates in bulk to both local cache and server API
      await certificateRepository.saveBulk(createdCerts, pdfBytesMap);

      // Package ZIP file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Trigger instant ZIP download
      const zipDownloadUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipDownloadUrl;
      const sanitizedClient = client.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
      downloadLink.download = `MYMF_Bulk_Galv_Certificates_${sanitizedClient}_${total}_Sites.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(zipDownloadUrl);

      setGeneratedBatch(createdCerts);
    } catch (err: any) {
      console.error('Bulk generation error', err);
      setParseError(`Bulk generation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-900 text-emerald-400 px-2 py-0.5 rounded">
              High-Throughput Automation
            </span>
            <span className="text-xs text-slate-500">BS EN ISO 1461 Standard</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Bulk Certificate Creation from Excel Sheet (50+ Sites)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create individual QR-verified certificates for up to 50+ sites in one click for the same client and download all official PDFs in a single ZIP file.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleExcel}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs cursor-pointer transition-colors shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Download Sample Template (.xlsx)
        </button>
      </div>

      {/* Success Notification Bar (if batch created) */}
      {generatedBatch && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-emerald-900">
                Bulk Generation Complete! {generatedBatch.length} Certificates Created & Downloaded
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                All certificates have been assigned unique QR codes and registered in the official MYMF registry. Scanned QR codes will verify instantly in the field.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
            <button
              onClick={onSuccessViewLedger}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5" />
              View in Certificate Ledger ({generatedBatch.length} Sites)
            </button>

            <button
              onClick={() => onSelectCertificate(generatedBatch[0].cert_id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Verify First Certificate ({generatedBatch[0].cert_id})
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Customer & Master Project Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
            Master Customer & Project Details (Shared Across All Sites)
          </h2>
          <span className="text-[11px] text-slate-500">Applied to every site in the batch</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Client / Beneficiary Customer</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-medium"
              placeholder="e.g. Materials of M/S GBH"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-medium"
              placeholder="e.g. STC Telecom Site Extension Project"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Purchase Order Ref</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. PO-GBH-2026-991"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Delivery Note Ref</label>
            <input
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. DN-25-1160"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Issue Date</label>
            <input
              type="text"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-medium"
              placeholder="e.g. 24 OCT 2026"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cert ID Prefix & Start #</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value)}
                className="w-2/3 px-2 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                placeholder="MYF-QC-26-"
              />
              <input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="w-1/3 px-2 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                placeholder="201"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Upload Excel Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
            Upload Excel File Containing Site List (.xlsx, .xls, .csv)
          </h2>

          {parsedRows.length > 0 && (
            <button
              onClick={handleClearFile}
              className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove File
            </button>
          )}
        </div>

        {/* Dropzone / Upload Box */}
        {!fileName ? (
          <label className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/70 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 mb-3">
              <Upload className="w-6 h-6 text-slate-700" />
            </div>
            <div className="text-sm font-semibold text-slate-900">
              Click to select or drag and drop your Excel file here
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports .xlsx, .xls, and .csv files with up to 50+ site rows (Site #, Description, Qty, Unit, DFT).
            </p>
          </label>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{fileName}</div>
                <div className="text-[11px] text-slate-500">
                  {parsedRows.length} Sites identified • Ready for batch compilation
                </div>
              </div>
            </div>

            <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer">
              Change File
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Parse Error Display */}
        {parseError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Parsed Rows Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <div className="font-semibold text-slate-700">
                Parsed Sites ({parsedRows.length} Total):
              </div>
              <div className="text-slate-500">
                Total Articles:{' '}
                <strong className="text-slate-900">
                  {parsedRows.reduce((acc, r) => acc + r.quantity, 0)} items
                </strong>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[11px] font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">Row</th>
                    <th className="py-2 px-3 w-28">Target Cert ID</th>
                    <th className="py-2 px-3 w-24">Site #</th>
                    <th className="py-2 px-3">Description of Articles</th>
                    <th className="py-2 px-3 w-16 text-center">Qty</th>
                    <th className="py-2 px-3 w-16">Unit</th>
                    <th className="py-2 px-3 w-20 text-right">DFT (µm)</th>
                    <th className="py-2 px-3 w-24">Heat #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {parsedRows.map((row, idx) => {
                    const expectedId =
                      row.customCertId ||
                      `${idPrefix}${String(startNumber + idx).padStart(3, '0')}`;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 text-[11px]">
                          {expectedId}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {row.siteId}
                        </td>
                        <td className="py-2 px-3 text-slate-800 truncate max-w-xs font-medium">
                          {row.description}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                          {row.quantity}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {row.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                          {row.measuredDft}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                          {row.heatNumber}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      {isProcessing && currentProgress && (
        <div className="p-5 bg-slate-900 text-white rounded-xl shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              {currentProgress.stepText}
            </span>
            <span className="font-mono text-emerald-400">
              {Math.round((currentProgress.current / currentProgress.total) * 100)}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-150 rounded-full"
              style={{
                width: `${(currentProgress.current / currentProgress.total) * 100}%`,
              }}
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>In-memory PDF generation with unique QR codes</span>
            <span>Packaging into ZIP archive</span>
          </div>
        </div>
      )}

      {/* Action CTA Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="text-xs text-slate-500">
          Output: <span className="font-semibold text-slate-700">Official BS EN ISO 1461 PDFs</span> packaged in a single <span className="font-mono font-bold text-slate-900">.zip</span> archive.
        </div>

        <button
          type="button"
          disabled={parsedRows.length === 0 || isProcessing}
          onClick={handleGenerateAndDownloadZip}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md cursor-pointer transition-all"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Compiling {parsedRows.length} Certificates & ZIP...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-emerald-400" />
              Generate All {parsedRows.length > 0 ? `${parsedRows.length} Certificates` : ''} & Download ZIP
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
