import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getStorageProvider, isR2Configured } from "@/lib/storage";
import { R2StorageProvider } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 storage belum dikonfigurasi." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename dan contentType harus diisi." },
        { status: 400 }
      );
    }

    // Validate file type (PDF only)
    if (contentType !== "application/pdf") {
      return NextResponse.json(
        { error: "Hanya file PDF yang diperbolehkan." },
        { status: 400 }
      );
    }

    const provider = getStorageProvider("r2") as R2StorageProvider;
    const presignedData = await provider.generatePresignedUploadUrl({
      filename,
      contentType,
      folder: "public-guides",
    });

    return NextResponse.json(presignedData);
  } catch (error) {
    console.error("Failed to generate presigned URL", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal generate presigned URL." },
      { status: 500 }
    );
  }
}
