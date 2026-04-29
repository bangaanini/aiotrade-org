import { NextResponse } from "next/server";
import { getPublishedPublicGuidePdfPostById } from "@/lib/public-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(value: string) {
  const filename = value
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return filename || "public-guide";
}

function getValidHttpUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const pdf = await getPublishedPublicGuidePdfPostById(id);

  if (!pdf) {
    return NextResponse.json({ error: "PDF tidak ditemukan." }, { status: 404 });
  }

  const fileUrl = getValidHttpUrl(pdf.fileUrl);

  if (!fileUrl) {
    return NextResponse.json({ error: "URL PDF tidak valid." }, { status: 404 });
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(fileUrl, {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to fetch public guide PDF", error);

    return NextResponse.json(
      { error: "PDF belum bisa dibuka sekarang." },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const cloudinaryError = upstreamResponse.headers.get("x-cld-error");
    const message = cloudinaryError?.toLowerCase().includes("deny")
      ? "Cloudinary memblokir delivery PDF ini. Aktifkan Allow delivery of PDF and ZIP files di Security settings Cloudinary, lalu coba lagi."
      : "PDF belum bisa dibuka sekarang.";

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentLength = upstreamResponse.headers.get("content-length");
  const contentType = upstreamResponse.headers.get("content-type") ?? "application/pdf";
  const filename = `${sanitizeFilename(pdf.title)}.pdf`;

  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", `inline; filename="${filename}"`);
  headers.set("Content-Type", contentType);

  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(upstreamResponse.body, {
    headers,
    status: 200,
  });
}
