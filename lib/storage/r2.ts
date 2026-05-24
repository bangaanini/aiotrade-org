import "server-only";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StorageProvider, UploadOptions, UploadResult } from "./types";

export class R2StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor() {
    const requiredEnvVars = [
      "R2_ENDPOINT",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_DOMAIN",
    ];

    const missing = requiredEnvVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`R2 configuration incomplete. Missing: ${missing.join(", ")}`);
    }

    this.bucketName = process.env.R2_BUCKET_NAME!;
    this.publicDomain = process.env.R2_PUBLIC_DOMAIN!;

    this.client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, folder = "public-guides" } = options;

    // Generate unique filename
    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${folder}/${timestamp}-${sanitized}`;

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      // Upload to R2
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      );
    } catch (error) {
      console.error("R2 upload failed:", error);
      throw new Error(
        `Failed to upload to R2: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return {
      publicId: key,
      secureUrl: `https://${this.publicDomain}/${key}`,
      bytes: file.size,
      format: file.type.split("/")[1] || "pdf",
      originalFilename: file.name,
      provider: "r2",
    };
  }

  getPublicUrl(publicId: string): string {
    return `https://${this.publicDomain}/${publicId}`;
  }
}
