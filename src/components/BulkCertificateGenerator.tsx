import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  FileCheck,
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
  const [client, setClient] = useState('Materials of M/S GBH');
  const [projectName, setProjectName] = useState('STC Telecom Site Extension Project - Northern Cluster');
  const [poNumber, setPoNumber] = useState('PO-GBH-2026-991');
  const [deliveryNote, setDeliveryNote] = useState('DN-25-1160');
  const [issueDate, setIssueDate] = useState('24 OCT 2026');
  const [idPrefix, setIdPrefix] = useState('MYF-QC-26-');
  const [startNumber, setStartNumber] = useState(201);
  const [bathTemp, setBathTemp] = useState(450);
  const [zincPurity, setZincPurity] = useState(99.995);
  const [minDft, setMinDft] = useState(85);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSiteRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    current: number;
    total: number;
    stepText: string;
  } | null>(null);
  const [generatedBatch, setGeneratedBatch] = useState<CertificateData[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const processFile = (file: File) => {
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
        setParseError(`Failed to parse file: ${err.message || 'Unknown error'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleClearFile = () => {
    setFileName(null);
    setParsedRows([]);
    setParseError(null);
    setGeneratedBatch(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
        const certId = row.customCertId || `${idPrefix}${String(startNumber + i).padStart(3, '0')}`;
        setCurrentProgress({ current: i + 1, total, stepText: 'Processing certificate ' + (i + 1) + ' of ' + total + '...' });
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
          notes: 'Certified that materials for Site ' + row.siteId + ' have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications.',
          verification_url: targetVerificationUrl,
          verification_count: 0,
          created_at: new Date().toISOString(),
        };

        const pdfGen = await generateCertificatePDF(certPayload, { hostDomain: currentHost });
        certPayload.sha256_hash = pdfGen.sha256Hash;
        certPayload.verification_url = pdfGen.verificationUrl;
        createdCerts.push(certPayload);
        pdfBytesMap.set(certPayload.cert_id, pdfGen.pdfBytes);
        const sanitizedSite = row.siteId.replace(/[^a-zA-Z0-9-_]/g, '_');
        zip.file(certId + '_Site_' + sanitizedSite + '_Galv_Cert.pdf', pdfGen.pdfBytes);
        if (i % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await certificateRepository.saveBulk(createdCerts, pdfBytesMap);
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const zipDownloadUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipDownloadUrl;
      const sanitizedClient = client.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
      downloadLink.download = 'MYMF_Bulk_Galv_Certificates_' + sanitizedClient + '_' + total + '_Sites.zip';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(zipDownloadUrl);
      setGeneratedBatch(createdCerts);
    } catch (err: any) {
      setParseError('Bulk generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  const handleDownloadSampleExcel = () => {
    const sampleData = [
      { 'Site #': 'ZUL033', 'Description of Articles': 'RF Extension Mount', 'Quantity': 2, 'Unit': '3M', 'Measured DFT (µm)': 92.4, 'Heat Number': 'HT-44810-B', 'Visual Inspection': 'PASS', 'Certificate ID (Optional)': '' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspection Sites');
    XLSX.writeFile(workbook, 'MYMF_Bulk_Galvanization_Sites_Template.xlsx');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Bulk Certificate Creation</h1>
        </div>
        <button type="button" onClick={handleDownloadSampleExcel} className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Download Sample Template
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <label
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={'border-2 border-dashed ' + (isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50') + ' hover:border-slate-400 hover:bg-slate-100/70 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer block'}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          <Upload className="w-8 h-8 text-slate-400 mb-2" />
          <div className="text-sm font-semibold text-slate-900">Click to select or drag and drop your Excel file here</div>
        </label>
      </div>

      {generatedBatch && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl">
           <p className="text-sm font-bold text-emerald-900">Generation Complete!</p>
        </div>
      )}

      {parseError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">{parseError}</div>}
      
      {parsedRows.length > 0 && (
         <button onClick={handleGenerateAndDownloadZip} className="w-full py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer">
           Generate & Download ZIP
         </button>
      )}
    </div>
  );
};
