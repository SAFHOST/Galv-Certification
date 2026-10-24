import { z } from 'zod';

export const LineItemSchema = z.object({
  item_no: z.number().int().positive(),
  site_id: z.string().min(1, 'Site ID is required (e.g. ZUL033)'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().default('PCS'),
  heat_number: z.string().optional(),
  measured_dft_um: z.number().nonnegative().optional(), // Dry Film Thickness in micrometers
  visual_inspection: z.enum(['PASS', 'FAIL', 'CONFORMING']).default('PASS'),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export const SignOffSchema = z.object({
  name: z.string().default('Adel Y. Aseery'),
  role: z.string().default('Quality Section Head'),
  department: z.string().default('QA/QC Inspection Department'),
  signed_at: z.string().optional(),
  signature_id: z.string().default('MYMF-SIG-AYA-0881'),
});

export type SignOff = z.infer<typeof SignOffSchema>;

export const OrganizationMetaSchema = z.object({
  name: z.string().default('Mohammed Yehya Al-Aseery For Metal Industries (MYMF)'),
  name_ar: z.string().default('مصنع محمد يحيى العسيري للصناعات المعدنية'),
  cr_number: z.string().default('1010997047'),
  vat_number: z.string().default('302154658900006'),
  address: z.string().default('PO Box 370372, Riyadh 11325, KSA'),
  tel: z.string().default('+966 11 498 2211'),
  email: z.string().default('qc@mymf.com.sa'),
  website: z.string().default('www.mymf.com.sa'),
  accreditation: z.string().default('ISO 9001:2015 & BS EN ISO 1461 Certified Facility'),
});

export type OrganizationMeta = z.infer<typeof OrganizationMetaSchema>;

export const TechnicalParametersSchema = z.object({
  standard: z.string().default('BS EN ISO 1461'),
  standard_title: z.string().default('Hot dip galvanized coatings on fabricated iron and steel articles'),
  bath_temperature_c: z.number().default(450),
  zinc_purity_percent: z.number().default(99.995),
  min_required_dft_um: z.number().default(85),
  flux_type: z.string().default('Triple Salt Zinc Ammonium Chloride'),
  pre_treatment: z.string().default('Caustic Degreasing, Hydrochloric Acid Pickling & Pre-fluxing'),
  passivation: z.string().default('Sodium Dichromate Quench Passivation'),
});

export type TechnicalParameters = z.infer<typeof TechnicalParametersSchema>;

export const CertificateDataSchema = z.object({
  cert_id: z.string().min(3, 'Certificate Reference ID is required'),
  issue_date: z.string().min(4, 'Issue Date is required'), // e.g. "30 SEP 2026" or "2026-09-30"
  client: z.string().min(1, 'Client/Beneficiary is required (e.g. Materials of M/S GBH)'),
  project_name: z.string().default('Industrial Telecommunications & Power Infrastructure'),
  purchase_order_no: z.string().default('PO-2026-GBH-4412'),
  delivery_note_no: z.string().default('DN-89021'),
  status: z.enum(['AUTHENTIC_VERIFIED', 'REVOKED', 'EXPIRED', 'PENDING_APPROVAL']).default('AUTHENTIC_VERIFIED'),
  organization: OrganizationMetaSchema.default(() => OrganizationMetaSchema.parse({})),
  technical_params: TechnicalParametersSchema.default(() => TechnicalParametersSchema.parse({})),
  line_items: z.array(LineItemSchema).min(1, 'At least one line item is required'),
  sign_off: SignOffSchema.default(() => SignOffSchema.parse({})),
  notes: z.string().default('Certified that the materials listed have been hot-dip galvanized in strict compliance with BS EN ISO 1461 standard specifications. All visual and thickness inspections conform to QA/QC acceptance criteria.'),
  verification_url: z.string().optional(),
  sha256_hash: z.string().optional(),
  storage_url: z.string().optional(),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type CertificateData = z.infer<typeof CertificateDataSchema>;

export interface VerificationResult {
  cert_id: string;
  is_valid: boolean;
  status: 'AUTHENTIC' | 'TAMPERED' | 'REVOKED' | 'NOT_FOUND';
  status_title: string;
  status_description: string;
  certificate?: CertificateData;
  calculated_hash?: string;
  recorded_hash?: string;
  verified_at: string;
  verification_count: number;
}

export interface StorageResult {
  provider: 'google_drive' | 'local_store' | 's3_compatible' | 'firebase';
  cert_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_url: string;
  public_view_link: string;
  stored_at: string;
}
