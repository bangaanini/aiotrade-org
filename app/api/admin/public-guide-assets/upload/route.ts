import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getStorageProvider, isR2Configured } from "@/lib/storage";
import { savePublicGuideAsset } from "@/lib/public-guides";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Configure body size limit for API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error("Failed to parse FormData:", parseError);
    return NextResponse.json(
      {
        error: "Gagal membaca file upload. Pastikan ukuran file tidak melebihi 25 MB.",
        details: parseError instanceof Error ? parseError.message : "Unknown error"
      },
      { status: 400 }
    );
  }

  try {
    const file = formData.get("file") as File;
    const label = formData.get("label") as string;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    // Validate file type (PDF only)
    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Hanya file PDF yang diperbolehkan." },
        { status: 400 }
      );
    }

    // Validate file size (25 MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File terlalu besar. Maksimal 25 MB.` },
        { status: 400 }
      );
    }

    // Upload to R2
    const provider = getStorageProvider("r2");
    const uploadResult = await provider.upload({ file, label });

    // Save metadata to database
    const asset = await savePublicGuideAsset({
      label: label || uploadResult.originalFilename,
      publicId: uploadResult.publicId,
      secureUrl: uploadResult.secureUrl,
      originalFilename: uploadResult.originalFilename,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      storageProvider: uploadResult.provider,
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Failed to upload to R2", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload gagal." },
      { status: 500 }
    );
  }
}
