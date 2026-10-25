import React, { useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import JSZip from 'jszip';
import { Upload, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import type { CertificateData, LineItem } from '../types/certificate';
import { certificateRepository } from '../services/storage';

interface BulkCertificateGeneratorProps {
  onSuccessViewLedger: () => void;
  onSelectCertificate: (certId: string) => void;
  onPreviewPDF: (cert: CertificateData) => void;
}

interface ParsedSiteRow {
  siteId: string;
  description: string;
  quantity: number;
  unit: string;
  heatNumber: string;
  measuredDft: number;
}

export const BulkCertificateGenerator: React.FC<BulkCertificateGeneratorProps> = ({ onSuccessViewLedger, onSelectCertificate, onPreviewPDF }) => {
  const [client, setClient] = useState('GBH');
  const [projectName, setProjectName] = useState('STC Telecom Site Extension Project');
  const [issueDate, setIssueDate] = useState('24 OCT 2026');
  const [poNumber, setPoNumber] = useState('PO-2026-GBH-8821');
  const [bathTemp, setBathTemp] = useState(450);
  const [zincPurity, setZincPurity] = useState(99.995);
  const [minDft, setMinDft] = useState(85);

  const [parsedData, setParsedData] = useState<ParsedSiteRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = read(data, { type: 'array' });
      const rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const parsed: ParsedSiteRow[] = rows.map((row: any) => ({
        siteId: String(row['Site #'] || row['site_id'] || row['Site ID'] || row['SITE ID'] || row['Site No'] || row['Site'] || '').trim(),
        description: String(row['Description of Articles'] || row['description'] || row['Description'] || row['ARTICLE'] || row['Article'] || '').trim(),
        quantity: Number(row['Quantity'] || row['QTY'] || row['qty'] || 1),
        unit: String(row['Unit'] || row['UNIT'] || 'PCS').trim(),
        heatNumber: String(row['Heat Number'] || row['HEAT NO'] || row['Heat No'] || row['heat_number'] || 'HT-N/A').trim(),
        measuredDft: Number(row['Measured DFT (µm)'] || row['Measured DFT'] || row['DFT'] || row['dft'] || 91.5),
      }));
      setParsedData(parsed);
      setError(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerate = async () => {
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const createdCerts: CertificateData[] = [];
      const pdfBytesMap = new Map<string, Uint8Array>();

      // Group data by siteId
      const groupedData = parsedData.reduce((acc, row) => {
        const normalizedSiteId = row.siteId.toUpperCase().trim();
        if (!normalizedSiteId) return acc;
        if (!acc[normalizedSiteId]) {
          acc[normalizedSiteId] = [];
        }
        acc[normalizedSiteId].push(row);
        return acc;
      }, {} as Record<string, ParsedSiteRow[]>);

      const siteIds = Object.keys(groupedData);
      const yearShort = new Date().getFullYear().toString().slice(-2);
      const startNum = Math.floor(100 + Math.random() * 800);

      for (let i = 0; i < siteIds.length; i++) {
        const siteId = siteIds[i];
        const rows = groupedData[siteId];
        const certId = `MYF-QC-${yearShort}-${startNum + i}`;
        
        const lineItems: LineItem[] = rows.map((row, index) => ({
          item_no: index + 1,
          site_id: siteId,
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          heat_number: row.heatNumber,
          measured_dft_um: row.measuredDft,
          visual_inspection: 'PASS'
        }));

        const certPayload: CertificateData = {
          cert_id: certId,
          issue_date: issueDate,
          client: client,
          project_name: projectName,
          purchase_order_no: poNumber,
          status: 'AUTHENTIC_VERIFIED',
          line_items: lineItems,
          created_at: new Date().toISOString(),
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
          sign_off: {
            name: 'Adel Y. Aseery',
            role: 'Quality Section Head',
            department: 'QA/QC Inspection Department',
            signed_at: new Date().toISOString(),
            signature_id: 'MYMF-SIG-AYA-0881',
          },
          technical_params: { 
            standard: 'BS EN ISO 1461', 
            bath_temperature_c: bathTemp, 
            zinc_purity_percent: zincPurity, 
            min_required_dft_um: minDft 
          }
        } as CertificateData;

        const { generateCertificatePDF } = await import('../services/pdfEngine');
        const { pdfBytes, fileName } = await generateCertificatePDF(certPayload);

        createdCerts.push(certPayload);
        pdfBytesMap.set(certId, pdfBytes);
        zip.file(fileName, pdfBytes);
      }

      await certificateRepository.saveBulk(createdCerts, pdfBytesMap);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MYMF_Certificates_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      onSuccessViewLedger();
    } catch (err: any) {
      console.error('Bulk Generation Error:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Site #': 'ZUL033',
        'Description of Articles': 'RF Extension Mount',
        'Quantity': 2,
        'Unit': 'PCS',
        'Measured DFT (µm)': 91.5,
        'Heat Number': 'HT-44810-B',
      },
    ];
    const worksheet = utils.json_to_sheet(sampleData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Inspection Data');
    writeFile(workbook, 'MYMF_Bulk_Certificate_Template.xlsx');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">Bulk Certificate Generator</h1>
      <div className="bg-white p-5 border rounded-xl space-y-4">
        <h2 className="font-bold text-sm">01. MASTER CERTIFICATE PARAMETERS</h2>
        <div className="grid grid-cols-2 gap-4">
          <input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="px-3 py-2 border rounded-lg" placeholder="Issue Date" />
          <input value={client} onChange={(e) => setClient(e.target.value)} className="px-3 py-2 border rounded-lg" placeholder="Client / Beneficiary" />
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="px-3 py-2 border rounded-lg" placeholder="Project Name / Site Ref" />
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="px-3 py-2 border rounded-lg" placeholder="Purchase Order Ref" />
        </div>
        <h2 className="font-bold text-sm mt-4">02. METALLURGICAL & GALVANIZATION SPECIFICATIONS</h2>
        <div className="grid grid-cols-3 gap-4">
          <input type="number" value={bathTemp} onChange={(e) => setBathTemp(Number(e.target.value))} placeholder="Zinc Bath Temp (°C)" className="px-3 py-2 border rounded-lg" />
          <input type="number" value={zincPurity} onChange={(e) => setZincPurity(Number(e.target.value))} placeholder="Zinc Ingot Purity (%)" className="px-3 py-2 border rounded-lg" />
          <input type="number" value={minDft} onChange={(e) => setMinDft(Number(e.target.value))} placeholder="Min Required DFT (µm)" className="px-3 py-2 border rounded-lg" />
        </div>
        
        <div className="flex justify-between items-center mt-4">
            <button onClick={handleDownloadSampleExcel} className="text-xs text-emerald-700 underline cursor-pointer">Download Sample Template</button>
            <label onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }} className={'border-2 border-dashed h-20 w-1/2 flex items-center justify-center rounded-xl cursor-pointer ' + (isDragging ? 'bg-emerald-50' : 'bg-slate-50')}>
              <Upload className="mr-2" />
              <span>Drop Excel File</span>
              <input type="file" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
            </label>
        </div>
      </div>

      {parsedData.length > 0 && (
        <div className="bg-white p-5 border rounded-xl space-y-4">
          <h2 className="font-bold text-sm">03. GENERATE</h2>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr><th className="p-2 border">Site</th><th className="p-2 border">Description</th><th className="p-2 border">Qty</th></tr>
            </thead>
            <tbody>
              {(() => {
                const groups = parsedData.reduce((acc, row) => {
                  const normalizedSiteId = row.siteId.toUpperCase().trim();
                  if (!normalizedSiteId) return acc;
                  if (!acc[normalizedSiteId]) acc[normalizedSiteId] = [];
                  acc[normalizedSiteId].push(row);
                  return acc;
                }, {} as Record<string, ParsedSiteRow[]>);
                
                return Object.entries(groups).map(([siteId, rows], i) => (
                  <React.Fragment key={siteId}>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={3} className="p-2 border text-[10px]">
                        CERTIFICATE #{i + 1} - SITE: {siteId} ({rows.length} Items)
                      </td>
                    </tr>
                    {rows.map((row, j) => (
                      <tr key={`${siteId}-${j}`}>
                        <td className="p-2 border pl-4 text-slate-500">{siteId}</td>
                        <td className="p-2 border">{row.description}</td>
                        <td className="p-2 border text-center">{row.quantity} {row.unit}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ));
              })()}
            </tbody>
          </table>
          <button onClick={handleGenerate} disabled={isProcessing} className="w-full py-3 bg-slate-900 text-white rounded-xl">
            {isProcessing ? 'Generating...' : 'Generate Certificates & Download ZIP'}
          </button>
        </div>
      )}
      {error && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg">{error}</div>}
    </div>
  );
};
