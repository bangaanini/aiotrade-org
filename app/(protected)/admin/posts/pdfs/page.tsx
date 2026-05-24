import { PublicGuidePdfComposerView } from "@/components/admin/public-guide-pdf-composer-view";
import { isR2Configured } from "@/lib/storage";
import { getPublicGuideAssets, getAdminPublicGuidePdfPosts } from "@/lib/public-guides";

type PublicGuidePdfPageProps = {
  searchParams: Promise<{
    message?: string | string[];
    pdf?: string | string[];
    status?: string | string[];
  }>;
};

export default async function PublicGuidePdfPage({ searchParams }: PublicGuidePdfPageProps) {
  const [assets, pdfs, resolvedSearchParams] = await Promise.all([
    getPublicGuideAssets(),
    getAdminPublicGuidePdfPosts(),
    searchParams,
  ]);

  const selectedPdfId =
    typeof resolvedSearchParams.pdf === "string"
      ? resolvedSearchParams.pdf
      : resolvedSearchParams.pdf?.[0];
  const status =
    typeof resolvedSearchParams.status === "string"
      ? resolvedSearchParams.status
      : resolvedSearchParams.status?.[0];
  const message =
    typeof resolvedSearchParams.message === "string"
      ? resolvedSearchParams.message
      : resolvedSearchParams.message?.[0];

  return (
    <PublicGuidePdfComposerView
      assets={assets}
      cloudinaryEnabled={isR2Configured()}
      message={message}
      pdfs={pdfs}
      selectedPdfId={selectedPdfId}
      status={status}
    />
  );
}
