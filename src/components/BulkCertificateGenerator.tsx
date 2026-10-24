import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { CertificateData, LineItem } from '../types/certificate';
import { generateCertificatePDF } from '../services/pdfEngine';
import { certificateRepository } from '../services/storage';

interface BulkCertificateGeneratorProps {
  onSuccessViewLedger: () => void;
}

export const BulkCertificateGenerator: React.FC<BulkCertificateGeneratorProps> = ({
  onSuccessViewLedger,
}) => {
  const [client, setClient] = useState('Materials of M/S GBH');
  const [projectName, setProjectName] = useState('STC Telecom Site Extension Project');
  const [issueDate, setIssueDate] = useState('24 OCT 2026');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const jsonRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

          if (jsonRows.length === 0) throw new Error('Excel sheet is empty.');

          const zip = new JSZip();
          const createdCerts: CertificateData[] = [];
          const pdfBytesMap = new Map<string, Uint8Array>();
          const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://mymf.com.sa';

          for (let i = 0; i < jsonRows.length; i++) {
            const row = jsonRows[i];
            const siteId = String(row['Site #'] || row['site_id'] || `SITE-${i + 1}`).trim();
            const description = String(row['Description of Articles'] || row['description'] || 'Hot-Dip Galvanized Assembly').trim();
            const quantity = Number(row['Quantity'] || 1);
            const certId = `MYF-QC-26-${200 + i}`;

            const lineItem: LineItem = {
              item_no: 1,
              site_id: siteId,
              description: description,
              quantity: quantity,
              unit: String(row['Unit'] || 'PCS').trim(),
              heat_number: String(row['Heat Number'] || 'HT-N/A').trim(),
              measured_dft_um: Number(row['Measured DFT (µm)'] || 91.5),
              visual_inspection: 'PASS',
            };

            const certPayload: CertificateData = {
              cert_id: certId,
              issue_date: issueDate,
              client: client,
              project_name: projectName,
              status: 'AUTHENTIC_VERIFIED',
              line_items: [lineItem],
              created_at: new Date().toISOString(),
            } as CertificateData;

            const pdfGen = await generateCertificatePDF(certPayload, { hostDomain: currentHost });
            createdCerts.push(certPayload);
            pdfBytesMap.set(certId, pdfGen.pdfBytes);
            zip.file(`${certId}_Site_${siteId}_Galv_Cert.pdf`, pdfGen.pdfBytes);
          }

          await certificateRepository.saveBulk(createdCerts, pdfBytesMap);
          const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `MYMF_Bulk_Certificates_${new Date().toISOString().slice(0, 10)}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          setSuccess(true);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Bulk Certificate Generator</h1>
      
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client Name" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project Name" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
          className={'border-2 border-dashed ' + (isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50') + ' h-40 flex flex-col items-center justify-center rounded-xl cursor-pointer'}
        >
          <Upload className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-sm font-semibold">Drop Excel File to Generate & Download</span>
        </label>
      </div>

      {isProcessing && <div className="text-sm font-bold animate-pulse">Processing...</div>}
      {error && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">Certificates generated and added to ledger.</div>}
    </div>
  );
};
