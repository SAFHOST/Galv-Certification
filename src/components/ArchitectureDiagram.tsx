import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  QrCode,
  FileText,
  Cloud,
  Database,
  Smartphone,
  Copy,
  Check,
  Code2,
} from 'lucide-react';

export const ArchitectureDiagram: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'gdrive_code' | 'security_hash'>('architecture');
  const [copiedCode, setCopiedCode] = useState(false);

  const googleDriveSnippet = `// Production Google Drive Service Account Upload Pattern
// Resolves: Deterministic Naming + In-Memory Buffer + ANYONE_WITH_LINK Public Permission
import { google } from 'googleapis';
import { Readable } from 'stream';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadCertificateToDrive(
  certId: string,
  pdfBuffer: Uint8Array,
  parentFolderId: string
) {
  const fileName = \`\${certId.replace(/[^a-zA-Z0-9-_]/g, '_')}_Galv_Cert.pdf\`;
  
  // 1. Create file stream in-memory without disk write
  const stream = new Readable();
  stream.push(pdfBuffer);
  stream.push(null);

  // 2. Upload to Google Drive
  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
      properties: {
        cert_id: certId,
        standard: 'BS EN ISO 1461',
        system: 'MYMF_QC',
      },
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = file.data.id!;

  // 3. Set Public Read-Only Permission (ANYONE_WITH_LINK)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    fileId,
    fileName,
    webViewLink: file.data.webViewLink,
    webContentLink: file.data.webContentLink,
  };
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(googleDriveSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          QA/QC Document Automation & QR-Encoding Architecture
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Eliminating the cyclic &ldquo;chicken-and-egg&rdquo; dependency in physical on-site inspection certificates
        </p>
      </div>

      {/* Segmented Tab */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
            activeTab === 'architecture' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          7-Step Architecture Flow
        </button>
        <button
          onClick={() => setActiveTab('gdrive_code')}
          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
            activeTab === 'gdrive_code' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Google Drive Service Account
        </button>
        <button
          onClick={() => setActiveTab('security_hash')}
          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
            activeTab === 'security_hash' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          SHA-256 Tamper Detection
        </button>
      </div>

      {activeTab === 'architecture' && (
        <div className="space-y-6">
          {/* Architecture Problem Statement Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2">The Architectural Problem</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              In traditional physical documentation, generating a document that contains its own verifiable download link creates a cyclic trap: you cannot know the link until the document is stored, but you cannot compile the final document until the QR code containing the link is embedded inside the PDF canvas.
            </p>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <span className="font-bold">Engineered Solution:</span>
              <span>
                Pre-determine the canonical verification endpoint <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">/verify/&#123;cert_id&#125;</code> before rendering, generate the QR code in-memory, embed it at exact executive coordinates, compile the PDF in-memory, and bind to storage concurrently.
              </span>
            </div>
          </div>

          {/* Step by Step Visual Pipeline */}
          <div className="space-y-3">
            {[
              {
                step: '01',
                title: 'Pre-Generate Internal Identifier (cert_id)',
                desc: 'Create unique reference (e.g. MYF-QC-25-116) using organization format or UUID prior to PDF layout compilation.',
                icon: <FileText className="w-5 h-5 text-slate-700" />,
                badge: 'Deterministic Seed',
              },
              {
                step: '02',
                title: 'Formulate Target Verification Endpoint',
                desc: 'Construct canonical public URL: https://[DOMAIN]/verify/{cert_id}. No storage lookup is required yet.',
                icon: <Layers className="w-5 h-5 text-slate-700" />,
                badge: 'Zero-Cyclic URL',
              },
              {
                step: '03',
                title: 'In-Memory QR Code Matrix Generation',
                desc: 'Generate QR code image in RAM using qrcode with Level-H error correction (30% physical damage tolerance for outdoor sites).',
                icon: <QrCode className="w-5 h-5 text-emerald-600" />,
                badge: 'RAM Buffer',
              },
              {
                step: '04',
                title: 'Executive PDF Layout Compilation (Puppeteer)',
                desc: 'Render official BS EN ISO 1461 document layout via headless Chrome. Inject dynamic QR code and static Arabic high-res image blocks into header and footer.',
                icon: <Code2 className="w-5 h-5 text-slate-700" />,
                badge: 'A4 Vector + Raster',
              },
              {
                step: '05',
                title: 'Storage Push & Deterministic Naming',
                desc: 'Push compiled PDF buffer to Google Drive / Firebase / S3 with standard key: {cert_id}_Galv_Cert.pdf and ANYONE_WITH_LINK permissions.',
                icon: <Cloud className="w-5 h-5 text-sky-600" />,
                badge: 'Deterministic Storage',
              },
              {
                step: '06',
                title: 'Persist Metadata & SHA-256 Hash to Database',
                desc: 'Commit cert_id, site_id, issue_date, storage_url, and cryptographic SHA-256 digest into persistent ledger.',
                icon: <Database className="w-5 h-5 text-indigo-600" />,
                badge: 'Immutable Ledger',
              },
              {
                step: '07',
                title: 'Public Mobile Field Verification Route',
                desc: 'Serve https://[DOMAIN]/verify/{cert_id} with responsive status badge, line-item details, and direct PDF stream.',
                icon: <Smartphone className="w-5 h-5 text-emerald-600" />,
                badge: 'Field Responsive',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">STEP {item.step}</span>
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded ml-auto">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'gdrive_code' && (
        <div className="bg-slate-900 rounded-xl p-5 text-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Google Drive Service Account Integration Pattern</h3>
              <p className="text-xs text-slate-400">In-memory stream upload with ANYONE_WITH_LINK read permission</p>
            </div>

            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied' : 'Copy Code'}
            </button>
          </div>

          <pre className="font-mono text-xs text-slate-300 overflow-x-auto p-3 bg-slate-950 rounded-lg max-h-[500px]">
            {googleDriveSnippet}
          </pre>
        </div>
      )}

      {activeTab === 'security_hash' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Cryptographic Anti-Tamper Security Architecture</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Industrial inspection certificates are susceptible to fraudulent post-issuance alterations (e.g. changing quantities, swapping site IDs, or forging coating thickness measurements). The system solves this with canonical SHA-256 payload hashing:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-900 mb-1">1. Canonical Serialization</div>
              <p className="text-slate-600">
                Line items, technical parameters (zinc bath temp, DFT values), and authorized sign-off are deterministically sorted and stringified into a canonical payload string, omitting transient database metadata.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-900 mb-1">2. Verification Integrity Check</div>
              <p className="text-slate-600">
                When a field inspector opens <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">/verify/[id]</code>, the canonical string is re-computed live and evaluated against the original sealed SHA-256 fingerprint. Any altered character triggers an immediate tamper alert.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
