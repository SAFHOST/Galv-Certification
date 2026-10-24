# Security Specification - QA/QC Certificate Management System

## 1. Data Invariants
- A certificate cannot exist without a valid cert_id and status.
- An audit trail entry cannot exist without a valid cert_id and must be linked to a certificate.
- Only authorized staff (determined by role) can issue certificates.
- Certificate status cannot be changed without an audit log entry.
- Audit trail entries are immutable after creation.

## 2. The "Dirty Dozen" Payloads

1. **Injection Attack:** Payload with `{cert_id: "'; DROP TABLE certificates; --"}`.
2. **Ghost Field:** Payload with `{cert_id: "MYF-QC-26-239", isVerified: true}`.
3. **Status Poisoning:** Payload trying to set `status` to an invalid value (e.g., `DELETED`).
4. **Orphan Audit:** Audit log entry with a non-existent `cert_id`.
5. **Timestamp Spoofing:** Audit log with `timestamp: "2099-01-01T00:00:00Z"`.
6. **ID Poisoning:** Payload with 2KB junk string as `cert_id`.
7. **Role Spoofing:** Payload attempting to set `user_id` as `ADMIN` when creating an audit entry.
8. **PII Isolation:** Attempt to read certificate list as unauthenticated user.
9. **Tamper Test:** Updating a whitelisted field (`client`) with an invalid type (boolean).
10. **Terminal State:** Updating a certificate that is already `REVOKED`.
11. **System Field Injection:** Attempting to update `sha256_hash` via client.
12. **Audit Immutable Test:** Attempting to update an existing audit entry.

## 3. Test Runner
Will be implemented in `firestore.rules.test.ts`.
