import { db } from './firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

export async function purgeAllCertificatesAndLogs(): Promise<{ success: boolean; deletedCount: number }> {
  if (!db) {
    throw new Error("Firestore database instance not initialized.");
  }

  const batch = writeBatch(db);
  let totalDeleted = 0;

  // 1. Fetch and queue all certificates for deletion
  const certsRef = collection(db, 'certificates');
  const certsSnapshot = await getDocs(certsRef);
  certsSnapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    totalDeleted++;
  });

  // 2. Fetch and queue all audit trail records for deletion
  const auditRef = collection(db, 'audit_logs');
  const auditSnapshot = await getDocs(auditRef);
  auditSnapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    totalDeleted++;
  });

  // Commit atomic batch deletion
  if (totalDeleted > 0) {
    await batch.commit();
  }

  return { success: true, deletedCount: totalDeleted };
}
