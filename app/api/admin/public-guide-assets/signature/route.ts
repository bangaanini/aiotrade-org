import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import {
  createCloudinarySignature,
  getCloudinaryConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout for large uploads

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary belum dikonfigurasi di environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Nama file tidak valid." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const { apiKey, cloudName, publicGuideFolder } = getCloudinaryConfig();
  const signature = createCloudinarySignature({
    folder: publicGuideFolder,
    timestamp,
  });

  return NextResponse.json({
    apiKey,
    cloudName,
    folder: publicGuideFolder,
    signature,
    timestamp,
  });
}
