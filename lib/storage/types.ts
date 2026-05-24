export type StorageProviderType = "cloudinary" | "r2";

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
  originalFilename: string;
  provider: StorageProviderType;
}

export interface UploadOptions {
  file: File;
  label?: string;
  folder?: string;
}

export interface StorageProvider {
  upload(options: UploadOptions): Promise<UploadResult>;
  delete?(publicId: string): Promise<void>;
  getPublicUrl(publicId: string): string;
}
