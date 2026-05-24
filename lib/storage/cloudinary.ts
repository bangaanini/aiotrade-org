import "server-only";

import type { StorageProvider, UploadOptions, UploadResult } from "./types";
import { getCloudinaryConfig, createCloudinarySignature } from "@/lib/cloudinary";

export class CloudinaryStorageProvider implements StorageProvider {
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, folder = "aiotrade/public-guides" } = options;

    // Get signature from existing cloudinary helper
    const config = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createCloudinarySignature({ folder, timestamp });

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", config.apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(payload?.error?.message ?? "Cloudinary upload failed");
    }

    const data = (await response.json()) as {
      bytes?: number;
      format?: string;
      original_filename?: string;
      public_id: string;
      secure_url: string;
    };

    return {
      publicId: data.public_id,
      secureUrl: data.secure_url,
      bytes: data.bytes || file.size,
      format: data.format || "pdf",
      originalFilename: data.original_filename || file.name,
      provider: "cloudinary",
    };
  }

  getPublicUrl(publicId: string): string {
    const config = getCloudinaryConfig();
    return `https://res.cloudinary.com/${config.cloudName}/raw/upload/${publicId}`;
  }
}
