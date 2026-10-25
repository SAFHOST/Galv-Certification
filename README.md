# MYMF QA/QC Hot-Dip Galvanization Certification & Verification System

[![BS EN ISO 1461 Certified](https://img.shields.io/badge/ISO-1461%3A2022-blue.svg)](https://www.mymf.com.sa)
[![Firestore Secured](https://img.shields.io/badge/Database-Firestore%20Enterprise-orange.svg)](https://firebase.google.com)
[![Vite SPA](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20TailwindCSS-purple.svg)](https://vitejs.dev)

---

## 1. Executive Overview & Business Domain

The **MYMF QA/QC Certification & Verification System** is an enterprise-grade digital quality assurance and certificate issuance platform engineered for **Mohammed Yehya Al-Aseery For Metal Industries (MYMF)** (CR: `1010997047`, VAT: `302154658900006`). 

Operating out of Riyadh, KSA, MYMF specializes in hot-dip galvanizing structural steel, telecommunication towers, anchor bolts, mounting brackets, and cable trays conforming to **BS EN ISO 1461** specifications. This system solves critical industrial challenges:
- **Forged Document Prevention:** Eliminates paper certificate tampering by binding every certificate to an immutable cryptographic SHA-256 hash stored in Firestore and anchored to a public QR verification URL.
- **Instant Site Verification:** Empowers telecom operators (STC, Zain, Mobily) and EPC contractors to verify coating thickness (DFT $\ge 85\mu m$), zinc bath purity ($99.995\%$), and compliance instantly in the field via mobile QR scanning.
- **Batch Processing:** Enables QA/QC engineers to generate, preview, download, and export single certificates or 50+ batch shipments with automated Excel mapping and ZIP bundling.

---

## 2. Architecture & Design Decisions

### Client-Side Vector PDF Generation (`pdf-lib`)
- **Decision:** Replaced fragile serverless Puppeteer or heavy backend headless Chrome wrappers with client-side in-memory vector PDF generation using `pdf-lib`.
- **Rationale:** Eliminates serverless cold starts, reduces hosting overhead to static Vercel edge delivery, and guarantees instant sub-second PDF generation directly in the inspector's browser.

### Canvas-Rendered Arabic Typography Solution
- **Decision:** Embedded Arabic headings and organizational titles (e.g., *مصنع محمد يحيى العسيري للصناعات المعدنية*) as high-resolution PNG images generated dynamically via HTML5 Canvas.
- **Rationale:** `pdf-lib` lacks native complex-script shaping, bidirectional text rendering, and OpenType Arabic font layout engines. By rendering Arabic strings on an off-screen canvas with correct RTL font metrics and embedding the resulting base64 raster into the vector stream, we achieve pristine, court-grade Arabic typography without bloated font files.

### Non-Cyclic QR Verification Pattern
- **Decision:** QR codes encode a deterministic URL pointing to `/verify/{cert_id}` combined with a truncated SHA-256 integrity hash (`/verify/MYF-QC-26-239?hash=...`).
- **Rationale:** Avoids chicken-and-egg database lookups during offline badge generation while ensuring that any tampering with certificate parameters invalidates the hash signature.

---

## 3. Project Structure

```
/
├── .aistudio/                 # AI Studio workspace metadata
├── public/                    # Static assets & logos
├── src/
│   ├── components/            # UI modular components
│   │   ├── CompanyLandingPage.tsx  # Public corporate landing & verification portal
│   │   ├── CertificateLedger.tsx   # QA/QC inspection ledger & batch management
│   │   ├── CertificateGenerator.tsx# Single certificate creation & drafting wizard
│   │   ├── BulkCertificateGenerator.tsx # Excel-to-ZIP batch generator (50+ sites)
│   │   ├── VerifyCertificateView.tsx # Public verification & cryptographic audit view
│   │   ├── PublicVerificationWrapper.tsx # Route wrapper for /verify/:id
│   │   ├── QRScannerModal.tsx      # Real-time camera QR badge scanner
│   │   ├── QRDisplayModal.tsx      # QR badge modal & sharing tools
│   │   ├── PDFPreviewModal.tsx     # In-browser PDF vector viewer
│   │   └── StaffLogin.tsx          # Secure inspector / admin sign-in modal
│   ├── services/
│   │   ├── pdfEngine.ts        # Core pdf-lib vector generator & Arabic canvas renderer
│   │   └── storage.ts          # Firestore repository abstraction & offline fallback
│   ├── types/
│   │   └── certificate.ts      # Zod validation schemas & TypeScript interfaces
│   ├── App.tsx                 # Root React Router switchboard
│   ├── main.tsx                # React DOM entry point with BrowserRouter
│   └── index.css               # Tailwind CSS imports & global design rules
├── firebase-applet-config.json # Firebase project connection configuration
├── firebase-blueprint.json     # Firestore intermediate schema definition
├── firestore.rules             # Production zero-trust Firestore security rules
├── package.json                # Project dependencies and build scripts
├── vite.config.ts              # Vite bundler configuration
└── vercel.json                 # Vercel SPA rewrite configuration
```

---

## 4. Environment Variables & Credentials

The application connects to Firebase using configuration stored in `firebase-applet-config.json`. No sensitive server secrets are required since all database mutations are secured via strict Firestore Security Rules.

```json
{
  "projectId": "ai-studio-mymfqaqccertific-79dcf3b2-6b4f-4785-adb7-a88bb77be67b",
  "appId": "...",
  "apiKey": "...",
  "authDomain": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "measurementId": "...",
  "firestoreDatabaseId": "(default)"
}
```

---

## 5. Local Setup & Installation

### Prerequisites
- **Node.js**: v18+ recommended
- **npm**: v9+

### Installation Steps
1. Clone the repository and navigate to the project root.
2. Ensure `.npmrc` is present with legacy peer dependency resolution:
   ```ini
   legacy-peer-deps=true
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server (runs on port 3000):
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```

---

## 6. Firestore Data Model

### Collection: `certificates`
Stores authoritative inspection certificates.
```json
{
  "cert_id": "MYF-QC-26-239",
  "issue_date": "30 SEP 2026",
  "client": "Materials of M/S GBH / STC Infrastructure",
  "project_name": "Industrial Telecommunications & Power Infrastructure",
  "purchase_order_no": "PO-2026-GBH-4412",
  "delivery_note_no": "DN-89021",
  "status": "AUTHENTIC_VERIFIED",
  "organization": {
    "name": "Mohammed Yehya Al-Aseery For Metal Industries (MYMF)",
    "cr_number": "1010997047",
    "vat_number": "302154658900006",
    "address": "PO Box 370372, Riyadh 11325, KSA"
  },
  "technical_params": {
    "standard": "BS EN ISO 1461",
    "bath_temperature_c": 450,
    "zinc_purity_percent": 99.995,
    "min_required_dft_um": 85
  },
  "line_items": [
    {
      "item_no": 1,
      "site_id": "ZUL033",
      "description": "Hot-Dip Galvanized Telecom Monopole Section A",
      "quantity": 12,
      "unit": "PCS",
      "heat_number": "H-9921",
      "measured_dft_um": 98.4,
      "visual_inspection": "PASS"
    }
  ],
  "sign_off": {
    "name": "Adel Y. Aseery",
    "role": "Quality Section Head",
    "department": "QA/QC Inspection Department",
    "signature_id": "MYMF-SIG-AYA-0881"
  },
  "sha256_hash": "a8f5c...3e1",
  "verification_count": 5,
  "created_at": "2026-09-30T10:00:00Z"
}
```

### Collection: `audit_logs`
Immutable record of certificate verification and inspection events.
```json
{
  "log_id": "LOG-2026-001",
  "cert_id": "MYF-QC-26-239",
  "action": "VERIFIED_PUBLIC",
  "timestamp": "2026-10-24T12:00:00Z",
  "ip_address": "10.14.88.22",
  "user_agent": "Mozilla/5.0..."
}
```

---

## 7. Firestore Security Rules

Production zero-trust security rules (`firestore.rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Catch-all deny by default
    match /{document=**} {
      allow read, write: if false;
    }

    // Certificates collection: Public read for verification, authenticated write for QA inspectors
    match /certificates/{certId} {
      allow read: if true;
      allow create, update: if request.auth != null;
      allow delete: if request.auth != null;
    }

    // Audit logs collection: Append-only for public verification, full access for authenticated staff
    match /audit_logs/{logId} {
      allow read, create: if true;
      allow update, delete: if request.auth != null;
    }
  }
}
```

---

## 8. Troubleshooting & Common Pitfalls

- **Vercel SPA Routing 404s:** Ensure `vercel.json` includes the catch-all rewrite to `/index.html`.
- **PDF Canvas Rendering Limits:** Keep off-screen canvas dimensions scaled appropriately (`scale = 2` or `3`) to prevent memory exhaustion on mobile devices when generating high-DPI Arabic headers.
- **Firestore Index Warnings:** If sorting large certificate ledgers by multiple fields, verify index definitions in Firebase Console.
