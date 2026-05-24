import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { isR2Configured } from "@/lib/storage";
import { saveMemberGuideAsset } from "@/lib/member-guides";

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
    const { key, publicUrl, filename, fileSize, label } = body;

    if (!key || !publicUrl || !filename || !fileSize) {
      return NextResponse.json(
        { error: "Data tidak lengkap." },
        { status: 400 }
      );
    }

    // Save metadata to database
    const asset = await saveMemberGuideAsset({
      label: label || filename.replace(/\.[^.]+$/, ""),
      publicId: key,
      secureUrl: publicUrl,
      originalFilename: filename,
      bytes: fileSize,
      format: "pdf",
      storageProvider: "r2",
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Failed to save asset metadata", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan metadata." },
      { status: 500 }
    );
  }
}
