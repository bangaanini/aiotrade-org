export type PublicGuideAsset = {
  bytes: number | null;
  createdAt: string;
  format: string | null;
  id: string;
  label: string;
  originalFilename: string | null;
  publicId: string;
  secureUrl: string;
  storageProvider: "cloudinary" | "r2";
};

export type PublicGuidePdfPost = {
  createdAt: string;
  description: string;
  fileAssetId: string | null;
  fileUrl: string;
  id: string;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
};
