import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { getPublicGuideAssets, savePublicGuideAsset } from "@/lib/public-guides";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout for large uploads

const assetSchema = z.object({
  bytes: z.number().int().nonnegative().nullable().optional(),
  format: z.string().trim().min(1).nullable().optional(),
  label: z.string().trim().min(1).max(120),
  originalFilename: z.string().trim().min(1).nullable().optional(),
  publicId: z.string().trim().min(1).max(240),
  secureUrl: z.string().trim().url(),
});

export async function GET() {
  const profile = await getCurrentProfile();

  if (!profile?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assets = await getPublicGuideAssets();

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload asset tidak valid." }, { status: 400 });
  }

  try {
    const asset = await savePublicGuideAsset(parsed.data);

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Failed to save public guide asset metadata", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan metadata PDF publik ke database.",
      },
      { status: 500 },
    );
  }
}
