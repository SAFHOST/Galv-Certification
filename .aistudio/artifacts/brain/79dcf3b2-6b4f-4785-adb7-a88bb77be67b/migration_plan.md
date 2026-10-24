# Migration Plan: CertificateRepository to Firestore

## Overview
Refactor `CertificateRepository` in `/src/services/storage.ts` to use Firestore as the primary, persistent storage engine, replacing the current `localStorage` and `fs` based implementation.

## Steps
1. **Initialize**: Replace `initialize()` logic to fetch certificates from the `certificates` collection in Firestore.
2. **Save**: Update `save()` to store data directly into Firestore using `setDoc`.
3. **Audit**: Ensure `addAudit` continues to work (it already uses Firestore).
4. **Cleanup**: Remove `persist()` and `localStorage`/`fs` logic.
5. **Sync**: Ensure `getAll()` and `getById()` use Firestore queries.

## Risk/Considerations
- Needs to handle potential network issues (Firebase offline cache should handle this if configured properly).
- Need to keep `initialSeeds` for fallback or new installations if the collection is empty.
