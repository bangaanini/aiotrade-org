export type MemberGuideType = "video" | "pdf";
export type MemberGuideSection = "start" | "activation" | "bot_settings" | "files";

export const MEMBER_GUIDE_SECTION_OPTIONS = [
  { description: "Materi pembuka untuk orientasi awal, langkah pertama, dan pengenalan area belajar member.", label: "Mulai", value: "start" },
  { description: "Kumpulan materi eCourse yang bisa berisi video pembelajaran atau dokumen PDF pendukung.", label: "eCourse", value: "activation" },
  {
    description: "Materi khusus AIOTrade untuk penggunaan fitur, alur kerja, dan penjelasan produk yang lebih dalam.",
    label: "AIOTrade",
    value: "bot_settings",
  },
  { description: "Kumpulan materi cara cuan, studi kasus, atau file referensi yang relevan untuk member.", label: "Cara Cuan", value: "files" },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: MemberGuideSection;
}>;

export const MEMBER_GUIDE_TYPE_OPTIONS = [
  {
    description: "Embed YouTube atau Vimeo agar materi bisa diputar langsung di dashboard member.",
    label: "Video",
    value: "video",
  },
  {
    description: "Upload atau pilih file PDF agar member bisa membuka dokumen di tab baru.",
    label: "PDF",
    value: "pdf",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: MemberGuideType;
}>;

export function getMemberGuideSectionLabel(section: MemberGuideSection) {
  const match = MEMBER_GUIDE_SECTION_OPTIONS.find((option) => option.value === section);

  return match?.label ?? "Pusat Belajar";
}

export type MemberGuideAsset = {
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

export type MemberGuidePost = {
  createdAt: string;
  description: string;
  embedUrl: string | null;
  fileAssetId: string | null;
  fileUrl: string | null;
  id: string;
  isPaid: boolean;
  isPublished: boolean;
  isUnlocked?: boolean;
  price: number | null;
  publishedAt: string;
  section: MemberGuideSection;
  sortOrder: number;
  title: string;
  type: MemberGuideType;
  updatedAt: string;
};
