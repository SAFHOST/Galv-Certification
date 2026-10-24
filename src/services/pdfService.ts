import { generateCertificatePDF } from './pdfEngine';
import { certificateRepository } from './storage';

export async function getPDF(certId: string): Promise<Uint8Array> {
  const cert = await certificateRepository.getById(certId);
  if (!cert) {
    throw new Error(`Certificate with ID '${certId}' was not found.`);
  }

  // Generate fresh on-demand strictly for this certificate
  // We don't have the pdfCache here, so just generate it fresh or rely on server-side cache if we add it
  const gen = await generateCertificatePDF(cert);
  return gen.pdfBytes;
}
