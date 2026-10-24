import React, { useState } from 'react';
import { Plus, Trash2, ShieldCheck, RefreshCw, Eye, Download, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CertificateData, LineItem } from '../types/certificate';
import { CertificateDataSchema } from '../types/certificate';
import { certificateRepository } from '../services/storage';
import QRCode from 'qrcode';
interface CertificateGeneratorProps {
  onCertificateCreated: (certId: string) => void;
  onPreviewPDF: (cert: CertificateData) => void;
}

export const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({
  onCertificateCreated,
  onPreviewPDF,
}) => {
  // Form State
  const [certId, setCertId] = useState<string>(() => {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const randNum = Math.floor(120 + Math.random() * 800);
    return `MYF-QC-${yearShort}-${randNum}`;
  });

  const [issueDate, setIssueDate] = useState<string>('24 OCT 2026');
  const [client, setClient] = useState<string>('GBH');
  const [projectName, setProjectName] = useState<string>('STC Telecom Site Extension Project - Northern Cluster');
  const [poNumber, setPoNumber] = useState<string>('PO-2026-GBH-8821');
  const [deliveryNote, setDeliveryNote] = useState<string>('DN-25-8821');

  // Technical Parameters
  const [bathTemp, setBathTemp] = useState<number>(450);
  const [zincPurity, setZincPurity] = useState<number>(99.995);
  const [minDft, setMinDft] = useState<number>(85);

  // Line Items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      item_no: 1,
      site_id: 'ZUL033',
      description: 'RF Extension Mount with all accessories',
      quantity: 2,
      unit: '3M',
      heat_number: 'HT-48901',
      measured_dft_um: 91.5,
      visual_inspection: 'PASS',
    },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{
    qrDataUrl: string;
    sha256Hash: string;
    verificationUrl: string;
  } | null>(null);

  const generateNewId = () => {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const randNum = Math.floor(120 + Math.random() * 800);
    setCertId(`MYF-QC-${yearShort}-${randNum}`);
  };

  const handleAddLineItem = () => {
    const nextItemNo = lineItems.length + 1;
    setLineItems([
      ...lineItems,
      {
        item_no: nextItemNo,
        site_id: lineItems[lineItems.length - 1]?.site_id || 'ZUL033',
        description: '',
        quantity: 1,
        unit: 'PCS',
        measured_dft_um: 88.0,
        visual_inspection: 'PASS',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    const updated = lineItems.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      item_no: idx + 1,
    }));
    setLineItems(updated);
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const buildCurrentCertificatePayload = (): CertificateData => {
    const hostDomain = typeof window !== 'undefined' ? window.location.origin : 'https://mymf-qc.industry.sa';
    const targetUrl = `${hostDomain}/verify/${encodeURIComponent(certId.trim())}`;

    return {
      cert_id: certId.trim().toUpperCase(),
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
      line_items: lineItems,
      sign_off: {
        name: 'Adel Y. Aseery',
        role: 'Quality Section Head',
        department: 'QA/QC Inspection Department',
        signed_at: new Date().toISOString(),
        signature_id: 'MYMF-SIG-AYA-0881',
      },
      notes: 'Certified that the materials listed have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications.',
      verification_url: targetUrl,
      verification_count: 0,
      created_at: new Date().toISOString(),
    };
  };

  const handleCompileAndStore = async () => {
    setValidationErrors([]);
    setIsGenerating(true);

    try {
      const payload = buildCurrentCertificatePayload();
      const parseResult = CertificateDataSchema.safeParse(payload);

      if (!parseResult.success) {
        const errorList = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        setValidationErrors(errorList);
        setIsGenerating(false);
        return;
      }

      // Step 3 & 4: Server-side PDF generation
      const response = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Raw Server Error Output:", responseText);
        throw new Error(`Server returned non-JSON error (${response.status}): ${responseText.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to generate certificate");
      }

      const { sha256_hash, verification_url } = result;
      payload.sha256_hash = sha256_hash;
      payload.verification_url = verification_url;
      
      // Need QR code for preview
      const qrDataUrl = await QRCode.toDataURL(verification_url, { errorCorrectionLevel: 'H', margin: 0, width: 280 });

      setPreviewData({
        qrDataUrl: qrDataUrl,
        sha256Hash: sha256_hash,
        verificationUrl: verification_url,
      });

      // Navigate to field verification
      onCertificateCreated(payload.cert_id);
    } catch (err: any) {
      console.error('Error generating certificate', err);
      setValidationErrors([err.message || 'An unexpected error occurred during PDF compilation']);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestPreview = async () => {
    const payload = buildCurrentCertificatePayload();
    onPreviewPDF(payload);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Generate QA/QC Hot-Dip Galvanization Certificate
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Conforming to BS EN ISO 1461 Standard • Mohammed Yehya Al-Aseery For Metal Industries (MYMF)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            Live Preview PDF
          </button>
        </div>
      </div>

      {/* Validation Errors Display */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
          <div className="font-bold">Validation Invariants Failed:</div>
          <ul className="list-disc list-inside">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 7-Step Architectural Pipeline Indicator */}
      <div className="bg-slate-900 text-slate-200 p-4 rounded-xl shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Automated 7-Step Non-Cyclic Architecture
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-[10px] text-emerald-400 font-mono">STEP 1 & 2</div>
            <div className="font-semibold text-white">Pre-Generate ID & Target URL</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{certId}</div>
          </div>
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-[10px] text-emerald-400 font-mono">STEP 3 & 4</div>
            <div className="font-semibold text-white">In-Memory QR & PDF-Lib</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Direct binary (no disk write)</div>
          </div>
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-[10px] text-emerald-400 font-mono">STEP 5 & 6</div>
            <div className="font-semibold text-white">Google Drive / DB Binding</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Deterministic storage link</div>
          </div>
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-[10px] text-emerald-400 font-mono">STEP 7</div>
            <div className="font-semibold text-white">Mobile Field Portal</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Instant inspector verification</div>
          </div>
        </div>
      </div>

      {/* Section 1: Certificate Master Identification */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          01. Master Certificate Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Certificate Reference Number (`cert_id`)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                placeholder="e.g. MYF-QC-25-116"
              />
              <button
                type="button"
                onClick={generateNewId}
                className="p-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                title="Generate new unique certificate ID"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Generated before rendering to eliminate cyclic dependency.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Issue Date</label>
            <input
              type="text"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 30 SEP 2026"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Client / Beneficiary</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. Materials of M/S GBH"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Project Name / Site Ref</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. Telecom Site Extension Project"
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
        </div>
      </div>

      {/* Section 2: BS EN ISO 1461 Technical Parameters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          02. Metallurgical & Galvanization Specifications
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Zinc Bath Temperature (°C)</label>
            <input
              type="number"
              value={bathTemp}
              onChange={(e) => setBathTemp(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">Standard range: 445°C - 455°C</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Zinc Ingot Purity (%)</label>
            <input
              type="number"
              step="0.001"
              value={zincPurity}
              onChange={(e) => setZincPurity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">Special High Grade (SHG) ≥ 99.995%</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Min Required DFT (µm)</label>
            <input
              type="number"
              value={minDft}
              onChange={(e) => setMinDft(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">ISO 1461 Table 3 requirement: ≥ 85 µm</p>
          </div>
        </div>
      </div>

      {/* Section 3: Dynamic Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              03. Inspected Material Line Items
            </h2>
            <p className="text-xs text-slate-500">Every item is bound into the immutable cryptographic SHA-256 fingerprint.</p>
          </div>

          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Article
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-12 gap-2 text-xs items-center"
            >
              <div className="col-span-1 text-center font-mono font-bold text-slate-400">
                #{item.item_no}
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Site #</label>
                <input
                  type="text"
                  value={item.site_id}
                  onChange={(e) => handleUpdateLineItem(idx, 'site_id', e.target.value)}
                  placeholder="e.g. ZUL033"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono font-bold text-slate-900 uppercase"
                />
              </div>

              <div className="col-span-4">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Description of Articles</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleUpdateLineItem(idx, 'description', e.target.value)}
                  placeholder="e.g. RF Extension Mount with all accessories"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Qty</label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleUpdateLineItem(idx, 'quantity', Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-right text-slate-900"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Unit</label>
                <select
                  value={item.unit}
                  onChange={(e) => handleUpdateLineItem(idx, 'unit', e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-slate-900"
                >
                  <option value="PCS">PCS</option>
                  <option value="M">M</option>
                  <option value="Set">Set</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="col-span-1">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">DFT (µm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={item.measured_dft_um || 88}
                  onChange={(e) => handleUpdateLineItem(idx, 'measured_dft_um', Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-right text-slate-900 font-semibold"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Status</label>
                <select
                  value={item.visual_inspection}
                  onChange={(e) => handleUpdateLineItem(idx, 'visual_inspection', e.target.value)}
                  className="w-full px-1 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-semibold"
                >
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                </select>
              </div>

              <div className="col-span-1 flex justify-center pt-3">
                <button
                  type="button"
                  disabled={lineItems.length <= 1}
                  onClick={() => handleRemoveLineItem(idx)}
                  className="text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Sign-off & Quality Authority */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          04. Authorized Sign-off & Quality Stamp
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Quality Head Name</label>
            <input
              type="text"
              readOnly
              value="Adel Y. Aseery"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role & Title</label>
            <input
              type="text"
              readOnly
              value="Quality Section Head"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Stamp & Seal</label>
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Official MYMF Seal Affixed
            </div>
          </div>
        </div>
      </div>

      {/* Submission CTA Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          Target Endpoint: <span className="font-mono text-slate-900">/verify/{certId}</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleTestPreview}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Preview Document
          </button>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleCompileAndStore}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Compiling & Storing...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Compile, QR-Encode & Register Certificate
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
