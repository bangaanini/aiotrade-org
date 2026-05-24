import "server-only";

import type { StorageProvider, StorageProviderType } from "./types";
import { R2StorageProvider } from "./r2";
import { CloudinaryStorageProvider } from "./cloudinary";

export * from "./types";

// Configuration: which provider to use for new uploads
const PDF_STORAGE_PROVIDER: StorageProviderType = "r2";

export function getStorageProvider(type?: StorageProviderType): StorageProvider {
  const providerType = type || PDF_STORAGE_PROVIDER;

  switch (providerType) {
    case "r2":
      return new R2StorageProvider();
    case "cloudinary":
      return new CloudinaryStorageProvider();
    default:
      throw new Error(`Unknown storage provider: ${providerType}`);
  }
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_DOMAIN
  );
}

export function isStorageConfigured(): boolean {
  return isR2Configured();
}
