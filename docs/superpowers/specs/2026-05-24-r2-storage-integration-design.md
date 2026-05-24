# Cloudflare R2 Storage Integration Design

**Date:** 2026-05-24  
**Author:** Claude (Kiro)  
**Status:** Ready for Implementation

## Executive Summary

This document specifies the integration of Cloudflare R2 as the primary storage provider for PDF uploads in the AIOTrade platform, replacing Cloudinary for new uploads while maintaining backward compatibility with existing Cloudinary-hosted files.

**Key Goals:**
- Support PDF uploads up to 25 MB (current Cloudinary free tier limit: 10 MB)
- Use custom domain `cdn.linkdirect.site` for file access
- Maintain backward compatibility with existing Cloudinary files
- Implement clean storage abstraction layer for future extensibility

## Background

### Current State
- PDF uploads use Cloudinary via client-side signature flow
- Cloudinary free tier limits files to 10 MB
- User encountered error uploading 19 MB PDF
- All assets stored in `public_guide_assets` table

### Problem
- Cloudinary free tier insufficient for larger PDF files
- Need to support up to 25 MB PDFs
- Cannot upgrade Cloudinary (cost constraints)

### Solution
- Migrate to Cloudflare R2 (10 GB free storage, unlimited egress)
- Support files up to 25 MB
- Keep Cloudinary code for backward compatibility
- Use storage abstraction layer for flexibility

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────┐
│  UI Component (PDF Composer)            │
│  - User uploads PDF                     │
│  - Calls uploadPdf()                    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Storage Factory (lib/storage/index.ts) │
│  - Determines provider (R2 for PDF)     │
│  - Returns provider instance            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ R2Provider  │  │ Cloudinary  │
│ (new PDFs)  │  │ (legacy)    │
└──────┬──────┘  └──────┬──────┘
       │                │
       ▼                ▼
┌─────────────────────────────────────────┐
│  Database (public_guide_assets)         │
│  - Stores metadata                      │
│  - Tracks storageProvider field         │
└─────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Storage Abstraction Layer

**Location:** `lib/storage/`

**Files:**
- `types.ts` - TypeScript interfaces and types
- `r2.ts` - R2 storage provider implementation
- `cloudinary.ts` - Cloudinary provider (backward compatibility)
- `index.ts` - Factory function and configuration

**Interface:**
```typescript
export interface StorageProvider {
  upload(options: UploadOptions): Promise<UploadResult>;
  delete?(publicId: string): Promise<void>;
  getPublicUrl(publicId: string): string;
}

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
  originalFilename: string;
  provider: StorageProviderType;
}
```

#### 2. R2 Provider

**Implementation:**
- Uses AWS S3 SDK (`@aws-sdk/client-s3`)
- R2 is S3-compatible
- Server-side upload (no client-side signatures needed)
- Files stored in `public-guides/` folder
- Filename format: `{timestamp}-{sanitized-filename}.pdf`

**Configuration:**
```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET_NAME=aiotrade-files
R2_PUBLIC_DOMAIN=cdn.linkdirect.site
```

#### 3. Database Schema

**Changes to `public_guide_assets` table:**

```sql
ALTER TABLE "public"."public_guide_assets"
ADD COLUMN "storage_provider" VARCHAR(20) DEFAULT 'cloudinary';

UPDATE "public"."public_guide_assets"
SET "storage_provider" = 'cloudinary'
WHERE "storage_provider" IS NULL;
```

**Prisma Schema:**
```prisma
model PublicGuideAsset {
  id               String   @id @default(uuid())
  label            String
  publicId         String   @unique @map("public_id")
  secureUrl        String   @map("secure_url")
  originalFilename String?  @map("original_filename")
  bytes            Int?
  format           String?
  storageProvider  String   @default("cloudinary") @map("storage_provider")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("public_guide_assets")
}
```

#### 4. API Routes

**New Route:** `POST /api/admin/public-guide-assets/upload`
- Handles server-side upload to R2
- Validates file type (PDF only)
- Validates file size (max 25 MB)
- Saves metadata to database
- Returns asset object

**Updated Route:** `POST /api/admin/public-guide-assets/signature`
- Simplified for R2 (no signature needed)
- Returns ready status

**Updated Route:** `POST /api/admin/public-guide-assets`
- Accepts `storageProvider` field
- Saves to database with provider tracking

#### 5. Frontend Updates

**Component:** `components/admin/public-guide-pdf-composer-view.tsx`

**Changes:**
- Upload directly to `/api/admin/public-guide-assets/upload`
- Remove Cloudinary signature flow
- Add provider badge display (R2 = blue, Cloudinary = orange)
- Show file size in MB
- Client-side validation (25 MB limit)

**Asset Display:**
```tsx
<span className={isR2 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}>
  {isR2 ? "R2" : "Cloudinary"}
</span>
```

## Data Flow

### Upload Flow (New PDFs)

1. **User Action:** Admin selects PDF file in UI
2. **Client Validation:** Check file size ≤ 25 MB, type = PDF
3. **Upload Request:** POST to `/api/admin/public-guide-assets/upload` with FormData
4. **Server Processing:**
   - Authenticate admin
   - Validate file (type, size)
   - Get R2 provider instance
   - Upload to R2 bucket
   - Generate public URL with custom domain
5. **Database Save:** Store metadata with `storageProvider: "r2"`
6. **Response:** Return asset object to client
7. **UI Update:** Add to asset library with R2 badge

### Access Flow (All Files)

1. **User clicks PDF link** in public guide page
2. **URL format:**
   - R2: `https://cdn.linkdirect.site/public-guides/{timestamp}-{filename}.pdf`
   - Cloudinary: `https://res.cloudinary.com/{cloud}/raw/upload/{public_id}`
3. **Browser fetches** file directly from storage provider
4. **File served** to user

## Error Handling

### Configuration Errors

**Missing R2 credentials:**
```typescript
if (!isR2Configured()) {
  throw new Error("R2 configuration incomplete. Missing: R2_ENDPOINT, ...");
}
```

**UI Display:**
```tsx
<Alert variant="error">
  R2 storage belum dikonfigurasi. Hubungi administrator.
</Alert>
```

### Upload Errors

**File too large:**
```typescript
if (file.size > 25 * 1024 * 1024) {
  return NextResponse.json(
    { error: "File terlalu besar. Maksimal 25 MB." },
    { status: 400 }
  );
}
```

**Invalid file type:**
```typescript
if (!["application/pdf"].includes(file.type)) {
  return NextResponse.json(
    { error: "Hanya file PDF yang diperbolehkan." },
    { status: 400 }
  );
}
```

**Network/R2 errors:**
```typescript
try {
  await this.client.send(new PutObjectCommand(...));
} catch (error) {
  console.error("R2 upload failed:", error);
  throw new Error(`Failed to upload to R2: ${error.message}`);
}
```

### Timeout Handling

**API route timeout:**
```typescript
export const maxDuration = 60; // 60 seconds for large files
```

**S3 Client timeout:**
```typescript
requestHandler: {
  requestTimeout: 60000, // 60 seconds
}
```

## Security

### Access Control
- Upload endpoint requires admin authentication
- R2 bucket set to public (files accessible via URL)
- No direct client-side upload (prevents abuse)

### File Validation
- Only PDF files allowed
- Size limit enforced (25 MB)
- Filename sanitization (remove special characters)

### Credentials Management
- R2 credentials in environment variables only
- Never committed to git
- API tokens with minimal permissions (Object Read & Write)
- Separate tokens for dev/staging/production

### URL Security
- Public URLs are predictable (timestamp + filename)
- Consider signed URLs for sensitive documents (future enhancement)

## Testing Strategy

### Unit Tests

**R2 Provider:**
```typescript
describe("R2StorageProvider", () => {
  it("should upload file successfully");
  it("should generate correct public URL");
  it("should throw error on missing config");
});
```

**Storage Factory:**
```typescript
describe("getStorageProvider", () => {
  it("should return R2 provider by default");
  it("should return Cloudinary provider when specified");
});
```

### Integration Tests

**Upload API:**
```typescript
describe("POST /api/admin/public-guide-assets/upload", () => {
  it("should upload PDF to R2 and save to database");
  it("should reject files larger than 25 MB");
  it("should reject non-PDF files");
  it("should require admin authentication");
});
```

### Manual Testing Checklist

- [ ] Upload PDF < 10 MB → goes to R2
- [ ] Upload PDF 10-25 MB → goes to R2
- [ ] Upload PDF > 25 MB → shows error
- [ ] Upload non-PDF file → shows error
- [ ] View uploaded file via cdn.linkdirect.site URL
- [ ] Old Cloudinary files still accessible
- [ ] Asset library shows both R2 and Cloudinary files with badges
- [ ] Select R2 file and save PDF post → works correctly
- [ ] Public guide page displays R2 PDFs correctly

## Deployment

### Prerequisites

1. **Cloudflare R2 Setup:**
   - Create bucket: `aiotrade-files`
   - Set bucket to public access
   - Create API token (Object Read & Write)
   - Note Account ID

2. **Custom Domain Setup:**
   - Connect `cdn.linkdirect.site` to R2 bucket
   - Wait for DNS propagation (5-10 minutes)
   - Test accessibility

3. **Environment Variables:**
   - Add R2 credentials to `.env`
   - Update production environment

### Deployment Steps

```bash
# 1. Install dependencies
npm install @aws-sdk/client-s3

# 2. Run database migration
npx prisma migrate dev --name add_storage_provider_to_assets

# 3. Generate Prisma client
npx prisma generate

# 4. Restart server
npm run dev

# 5. Test upload
# - Login as admin
# - Go to /admin/posts/pdfs
# - Upload test PDF
# - Verify R2 badge and URL
```

### Rollback Plan

**Option A: Quick Disable**
```typescript
// In lib/storage/index.ts
const PDF_STORAGE_PROVIDER: StorageProviderType = "cloudinary";
```

**Option B: Environment Toggle**
```env
PDF_STORAGE_PROVIDER=cloudinary
```

**Option C: Full Rollback**
```bash
git revert <commit-hash>
npm uninstall @aws-sdk/client-s3
npx prisma migrate rollback
npm run dev
```

## Monitoring

### Metrics to Track

1. **Upload Success Rate**
   - Track failed uploads in logs
   - Alert if failure rate > 5%

2. **File Accessibility**
   - Periodic check: can files be downloaded?
   - Monitor 404 errors

3. **Storage Usage**
   - Check R2 dashboard weekly
   - Free tier: 10 GB/month

4. **Upload Performance**
   - Track upload duration
   - Alert if upload takes > 30 seconds

### Logging

```typescript
console.log(`[R2] Uploading file: ${file.name} (${file.size} bytes)`);
console.log(`[R2] Upload successful: ${result.secureUrl}`);
console.error(`[R2] Upload failed:`, error);
```

## Cost Analysis

### Cloudflare R2 Pricing

| Metric | Free Tier | Overage Cost |
|--------|-----------|--------------|
| Storage | 10 GB/month | $0.015/GB/month |
| Class A Operations (write) | 1M requests/month | $4.50/million |
| Class B Operations (read) | 10M requests/month | $0.36/million |
| Egress (downloads) | Unlimited | FREE |

### Estimated Usage
- 100 PDFs/month @ 5 MB avg = 500 MB storage
- 1,000 downloads/month = 1,000 Class B operations
- **Total cost: $0** (well within free tier)

### Comparison with Cloudinary
- Cloudinary free: 25 GB storage, 25 GB bandwidth/month, 10 MB file limit
- R2 advantage: 25 MB files + unlimited egress

## Future Enhancements

### Phase 2 (Optional)

1. **Migrate Old Files**
   - Script to copy Cloudinary files to R2
   - Update database URLs
   - Keep Cloudinary as backup

2. **Delete Functionality**
   - Implement `delete()` method in providers
   - Add "Delete" button in admin UI
   - Soft delete with confirmation

3. **Image Support**
   - Extend R2 provider for images
   - Image optimization/resizing

4. **CDN Analytics**
   - Track download counts
   - Popular files dashboard

5. **Signed URLs**
   - Private bucket with temporary access URLs
   - Enhanced security for sensitive documents

## Dependencies

### New Dependencies
```json
{
  "@aws-sdk/client-s3": "^3.700.0"
}
```

### Environment Variables
```env
# Cloudflare R2 Storage
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET_NAME=aiotrade-files
R2_PUBLIC_DOMAIN=cdn.linkdirect.site
```

## Files to Create

```
lib/storage/
  ├── types.ts              # Interfaces and types
  ├── r2.ts                 # R2 provider implementation
  ├── cloudinary.ts         # Cloudinary provider (backward compat)
  └── index.ts              # Factory and configuration

app/api/admin/public-guide-assets/
  └── upload/
      └── route.ts          # New upload endpoint

docs/superpowers/specs/
  └── 2026-05-24-r2-storage-integration-design.md  # This document
```

## Files to Modify

```
lib/public-guides.ts                              # Add storageProvider support
lib/public-guide-types.ts                         # Add storageProvider to type
components/admin/public-guide-pdf-composer-view.tsx  # Update upload flow
app/api/admin/public-guide-assets/route.ts        # Add storageProvider field
app/api/admin/public-guide-assets/signature/route.ts  # Simplify for R2
prisma/schema.prisma                              # Add storageProvider field
.env.example                                      # Add R2 variables
package.json                                      # Add @aws-sdk/client-s3
```

## Success Criteria

- [ ] Can upload PDFs up to 25 MB successfully
- [ ] Files accessible via `cdn.linkdirect.site`
- [ ] Old Cloudinary files remain accessible
- [ ] Asset library shows provider badges
- [ ] No breaking changes to existing functionality
- [ ] All tests passing
- [ ] Documentation complete

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| R2 service outage | High | Keep Cloudinary as fallback option |
| DNS propagation delay | Medium | Test custom domain before deployment |
| File size validation bypass | Low | Server-side validation enforced |
| Cost overrun | Low | Monitor usage, well within free tier |
| Migration complexity | Medium | Phased approach, backward compatibility |

## Conclusion

This design provides a clean, extensible solution for integrating Cloudflare R2 storage while maintaining backward compatibility with existing Cloudinary files. The storage abstraction layer allows for future provider additions without major refactoring.

The implementation supports the immediate need (25 MB PDF uploads) while setting up infrastructure for future enhancements like file migration, delete functionality, and multi-provider support.
