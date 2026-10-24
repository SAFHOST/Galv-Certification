const fs = require('fs');
const path = require('path');

const fontBase64 = fs.readFileSync('font_base64.txt', 'utf8').trim();
const logoBase64 = fs.readFileSync('logo_base64.txt', 'utf8').trim();
const signatureBase64 = fs.readFileSync('signature_base64.txt', 'utf8').trim();
const stampBase64 = fs.readFileSync('stamp_base64.txt', 'utf8').trim();

const content = `
export const PDF_ASSETS = {
  fonts: {
    cairo: '${fontBase64}'
  },
  images: {
    logo: 'data:image/jpeg;base64,${logoBase64}',
    signature: 'data:image/jpeg;base64,${signatureBase64}',
    stamp: 'data:image/jpeg;base64,${stampBase64}'
  }
};

export const CERTIFICATE_TEMPLATE = (data: any) => \`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        @font-face {
            font-family: 'Cairo';
            src: url(data:font/ttf;charset=utf-8;base64,\${PDF_ASSETS.fonts.cairo}) format('truetype');
            font-weight: normal;
            font-style: normal;
        }
        
        body {
            font-family: 'Cairo', 'Helvetica', sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
            line-height: 1.4;
            font-size: 12px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 2px solid #008080;
            padding-bottom: 10px;
        }

        .header-left {
            width: 35%;
            font-size: 11px;
        }

        .header-center {
            width: 30%;
            text-align: center;
        }

        .header-center img {
            width: 120px; /* Increased by 50% from original approx 80px */
            height: auto;
        }

        .header-right {
            width: 35%;
            text-align: right;
            direction: rtl;
            font-size: 13px;
        }

        .title-bar {
            text-align: center;
            margin: 20px 0;
        }

        .title-bar h1 {
            margin: 0;
            font-size: 20px;
            color: #000;
            text-decoration: underline;
            font-weight: bold;
        }

        .metadata-bar {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-weight: bold;
        }

        .content-body {
            margin: 20px 0;
            text-align: justify;
            font-size: 13px;
        }

        .table-container {
            margin: 20px 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #333;
        }

        th, td {
            border: 1px solid #333;
            padding: 8px;
            text-align: center;
        }

        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }

        /* Column widths: Item # (8%) | Site # (27%) | Description (45%) | Quantity (10%) | Unit (10%) */
        .col-item { width: 8%; }
        .col-site { width: 27%; }
        .col-desc { width: 45%; text-align: left; }
        .col-qty { width: 10%; }
        .col-unit { width: 10%; }

        .footer-signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 50px;
        }

        .signature-block {
            text-align: center;
            width: 35%;
        }

        .signature-block img {
            max-width: 150px;
            height: auto;
            display: block;
            margin: 0 auto 5px;
        }

        .stamp-block {
            width: 30%;
            text-align: center;
        }

        .stamp-block img {
            max-width: 120px;
            height: auto;
        }

        .qr-block {
            width: 35%;
            text-align: right;
        }

        .qr-block img {
            width: 100px;
            height: 100px;
        }

        .address-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <strong>Mohammed Yehya Al-Aseery</strong><br>
            For Metal Industries<br>
            CR No: 1010997047<br>
            VAT No: 302154658900006
        </div>
        <div class="header-center">
            <img src="\${PDF_ASSETS.images.logo}" alt="MYMF Logo">
        </div>
        <div class="header-right">
            <strong>مصنع محمد يحيى العسيري</strong><br>
            للصناعات المعدنية<br>
            س.ت: 1010997047<br>
            الرقم الضريبي: 302154658900006
        </div>
    </div>

    <div class="title-bar">
        <h1>HOT DIP GALVANIZATION CERTIFICATE</h1>
    </div>

    <div class="metadata-bar">
        <span>Cert. Ref. No.: \${data.certRef}</span>
        <span>Date: \${data.issueDate}</span>
    </div>

    <div class="content-body">
        Mohammed Yehya Al-Aseery Factory For Metal Industries (MYMAF) certifies that the materials of M/S \${data.cleanClientName} were hot-dip galvanized in conformance with BS EN ISO 1461 Standard.
    </div>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="col-item">Item #</th>
                    <th class="col-site">Site #</th>
                    <th class="col-desc">Description</th>
                    <th class="col-qty">Qty</th>
                    <th class="col-unit">Unit</th>
                </tr>
            </thead>
            <tbody>
                \${data.items.map((item: any, index: number) => \`
                <tr>
                    <td>\${index + 1}</td>
                    <td>\${item.siteNo || '-'}</td>
                    <td>\${item.description}</td>
                    <td>\${item.quantity}</td>
                    <td>\${item.unit}</td>
                </tr>
                \`).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer-signatures">
        <div class="signature-block">
            <div style="font-weight: bold; margin-bottom: 10px;">Mohammed Yehya Al-Aseery Factory (MYMAF)</div>
            <img src="\${PDF_ASSETS.images.signature}" alt="Signature">
            <div style="border-top: 1px solid #000; padding-top: 5px;">
                <strong>Adel Y. Aseery</strong><br>
                Quality Section Head
            </div>
        </div>
        <div class="stamp-block">
            <img src="\${PDF_ASSETS.images.stamp}" alt="Factory Stamp">
        </div>
        <div class="qr-block">
            <img src="\${data.qrCodeUrl}" alt="Verification QR">
        </div>
    </div>

    <div class="address-footer">
        Kingdom of Saudi Arabia | P.O. Box: 370372, Riyadh 11325 | المملكة العربية السعودية
    </div>
</body>
</html>
\`;
`;

fs.writeFileSync('src/services/pdfAssets.ts', content);
