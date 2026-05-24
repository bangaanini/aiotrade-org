"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CloudUpload, ExternalLink, FileText, PlusCircle, Sparkles } from "lucide-react";
import { savePublicGuidePdfPostAction } from "@/app/(protected)/admin/posts/pdfs/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicGuideAsset, PublicGuidePdfPost } from "@/lib/public-guide-types";
import { cn } from "@/lib/utils";

type PublicGuidePdfComposerViewProps = {
  assets: PublicGuideAsset[];
  cloudinaryEnabled: boolean; // Now represents R2 configured status
  message?: string;
  pdfs: PublicGuidePdfPost[];
  selectedPdfId?: string;
  status?: string;
};

type DraftPdf = {
  description: string;
  fileAssetId: string | null;
  fileUrl: string | null;
  id: string | null;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
  title: string;
};

const EMPTY_PDF: DraftPdf = {
  description: "",
  fileAssetId: null,
  fileUrl: null,
  id: null,
  isPublished: true,
  publishedAt: new Date().toISOString().slice(0, 16),
  sortOrder: 0,
  title: "",
};

function toDraftPdf(pdf: PublicGuidePdfPost | null | undefined): DraftPdf {
  if (!pdf) {
    return EMPTY_PDF;
  }

  return {
    description: pdf.description,
    fileAssetId: pdf.fileAssetId,
    fileUrl: pdf.fileUrl,
    id: pdf.id,
    isPublished: pdf.isPublished,
    publishedAt: pdf.publishedAt.slice(0, 16),
    sortOrder: pdf.sortOrder,
    title: pdf.title,
  };
}

function statusAlert(status?: string, message?: string) {
  switch (status) {
    case "saved":
      return { message: "PDF publik berhasil disimpan.", variant: "success" as const };
    case "invalid":
      return {
        message: message || "Data PDF publik belum lengkap. Cek lagi form-nya.",
        variant: "error" as const,
      };
    case "error":
      return {
        message: message || "PDF publik belum bisa disimpan sekarang.",
        variant: "error" as const,
      };
    default:
      return null;
  }
}

function TextField({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function PublicGuidePdfComposerView({
  assets,
  cloudinaryEnabled,
  message,
  pdfs,
  selectedPdfId,
  status,
}: PublicGuidePdfComposerViewProps) {
  const selectedPdf = useMemo(
    () => (selectedPdfId ? pdfs.find((pdf) => pdf.id === selectedPdfId) ?? null : null),
    [pdfs, selectedPdfId],
  );
  const [draft, setDraft] = useState<DraftPdf>(() => toDraftPdf(selectedPdf));
  const [library, setLibrary] = useState(assets);
  const [assetLabel, setAssetLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateDraft<K extends keyof DraftPdf>(key: K, value: DraftPdf[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetComposer() {
    setDraft(EMPTY_PDF);
    setUploadError(null);
    setUploadMessage(null);
  }

  async function handlePdfUpload(file: File | null) {
    if (!file) {
      return;
    }

    // Validasi ukuran file maksimal 25 MB
    const maxSizeInBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSizeInBytes) {
      setUploadError(
        `Ukuran file terlalu besar. Maksimal 25 MB. File Anda: ${(file.size / 1024 / 1024).toFixed(2)} MB`
      );
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      // Step 1: Get presigned URL from server
      const presignedResponse = await fetch("/api/admin/public-guide-assets/presigned-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedResponse.ok) {
        const payload = (await presignedResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Gagal mendapatkan presigned URL.");
      }

      const { uploadUrl, key, publicUrl } = (await presignedResponse.json()) as {
        uploadUrl: string;
        key: string;
        publicUrl: string;
      };

      // Step 2: Upload directly to R2 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload ke R2 gagal.");
      }

      // Step 3: Confirm upload and save metadata to database
      const confirmResponse = await fetch("/api/admin/public-guide-assets/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          publicUrl,
          filename: file.name,
          fileSize: file.size,
          label: assetLabel.trim() || file.name.replace(/\.[^.]+$/, ""),
        }),
      });

      if (!confirmResponse.ok) {
        const payload = (await confirmResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Gagal menyimpan metadata.");
      }

      const payload = (await confirmResponse.json()) as { asset: PublicGuideAsset };

      setLibrary((current) => [payload.asset, ...current.filter((asset) => asset.id !== payload.asset.id)]);
      setDraft((current) => ({
        ...current,
        fileAssetId: payload.asset.id,
        fileUrl: payload.asset.secureUrl,
      }));
      setUploadMessage(
        `PDF berhasil diupload ke R2 storage (${(file.size / 1024 / 1024).toFixed(2)} MB)`
      );
      setAssetLabel("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload PDF gagal.");
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const activeAlert = statusAlert(status, message);

  return (
    <div className="space-y-6">
      {activeAlert ? <Alert variant={activeAlert.variant}>{activeAlert.message}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Posting PDF</CardTitle>
                  <CardDescription>
                    Upload file panduan PDF publik untuk halaman guide.
                  </CardDescription>
                </div>
                <Button onClick={resetComposer} variant="outline">
                  <PlusCircle className="h-4 w-4" />
                  PDF Baru
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form action={savePublicGuidePdfPostAction} className="space-y-6">
                <input name="pdfId" type="hidden" value={draft.id ?? ""} />
                <input name="title" type="hidden" value={draft.title} />
                <input name="description" type="hidden" value={draft.description} />
                <input name="fileAssetId" type="hidden" value={draft.fileAssetId ?? ""} />
                <input name="fileUrl" type="hidden" value={draft.fileUrl ?? ""} />
                <input name="sortOrder" type="hidden" value={String(draft.sortOrder)} />
                <input name="publishedAt" type="hidden" value={draft.publishedAt} />
                <input name="isPublished" type="hidden" value={String(draft.isPublished)} />

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-3 text-stone-900 shadow-sm">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-950">PDF Panduan Publik</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        File yang diupload di sini akan tampil di halaman <span className="font-semibold">/guide</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <TextField
                    label="Judul PDF"
                    name="public-guide-title"
                    onChange={(value) => updateDraft("title", value)}
                    placeholder="Mis. Panduan Aktivasi API"
                    value={draft.title}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="public-guide-order">Urutan Tampil</Label>
                    <Input
                      id="public-guide-order"
                      min={0}
                      onChange={(event) => updateDraft("sortOrder", Number(event.target.value) || 0)}
                      type="number"
                      value={String(draft.sortOrder)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="public-guide-description">Deskripsi Singkat</Label>
                  <textarea
                    className="min-h-28 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                    id="public-guide-description"
                    onChange={(event) => updateDraft("description", event.target.value)}
                    rows={4}
                    value={draft.description}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid gap-2">
                    <Label htmlFor="public-guide-published-at">Tanggal Publish</Label>
                    <Input
                      id="public-guide-published-at"
                      onChange={(event) => updateDraft("publishedAt", event.target.value)}
                      type="datetime-local"
                      value={draft.publishedAt}
                    />
                  </div>
                  <label className="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800">
                    <input
                      checked={draft.isPublished}
                      className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                      onChange={(event) => updateDraft("isPublished", event.target.checked)}
                      type="checkbox"
                    />
                    Langsung publish
                  </label>
                </div>

                <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  {!cloudinaryEnabled ? <Alert variant="error">R2 storage belum dikonfigurasi.</Alert> : null}
                  {uploadError ? <Alert variant="error">{uploadError}</Alert> : null}
                  {uploadMessage ? <Alert variant="success">{uploadMessage}</Alert> : null}

                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">Info:</span> Ukuran maksimal file PDF adalah 25 MB
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <TextField
                      label="Label PDF Baru"
                      name="public-guide-asset-label"
                      onChange={setAssetLabel}
                      placeholder="Panduan Member PDF"
                      value={assetLabel}
                    />
                    <div className="flex items-end">
                      <input
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => handlePdfUpload(event.target.files?.[0] ?? null)}
                        ref={fileInputRef}
                        type="file"
                      />
                      <Button
                        disabled={!cloudinaryEnabled || uploading}
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                        variant="outline"
                      >
                        <CloudUpload className="h-4 w-4" />
                        {uploading ? "Uploading..." : "Upload PDF"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {library.map((asset) => {
                      const isSelected = asset.id === draft.fileAssetId;
                      const isR2 = asset.storageProvider === "r2";

                      return (
                        <button
                          className={cn(
                            "rounded-xl border px-4 py-4 text-left transition",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                              : "border-stone-200 bg-white hover:border-stone-300",
                          )}
                          key={asset.id}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              fileAssetId: asset.id,
                              fileUrl: asset.secureUrl,
                            }))
                          }
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-stone-900">{asset.label}</p>
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                    isR2
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-orange-100 text-orange-700"
                                  )}
                                >
                                  {isR2 ? "R2" : "Cloudinary"}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-stone-500">
                                {asset.originalFilename ?? asset.format ?? "PDF document"}
                              </p>
                              {asset.bytes ? (
                                <p className="mt-1 text-xs text-stone-400">
                                  {(asset.bytes / 1024 / 1024).toFixed(2)} MB
                                </p>
                              ) : null}
                            </div>
                            {isSelected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit">
                    <Sparkles className="h-4 w-4" />
                    Simpan PDF
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Preview ini meniru card PDF yang akan tampil di halaman guide publik.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  <FileText className="h-4 w-4" />
                  PDF Publik
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                  {draft.title.trim() || "Judul PDF akan tampil di sini"}
                </h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {draft.description.trim() || "Deskripsi singkat PDF akan membantu pengunjung memahami isi panduan."}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">File</p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {draft.fileUrl ? "PDF siap dibuka" : "Belum ada file PDF"}
                    </p>
                  </div>
                  {draft.fileUrl ? (
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                      href={draft.fileUrl}
                      target="_blank"
                    >
                      Open
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Published PDF</CardTitle>
              <CardDescription>Dokumen terbaru yang sudah pernah dibuat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pdfs.slice(0, 5).map((pdf) => (
                <Link
                  className="block rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 transition hover:bg-stone-100"
                  href={`/admin/posts/pdfs?pdf=${pdf.id}`}
                  key={pdf.id}
                >
                  <p className="text-sm font-semibold text-stone-950">{pdf.title}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Urutan #{pdf.sortOrder} • {pdf.isPublished ? "Published" : "Draft"}
                  </p>
                </Link>
              ))}

              {!pdfs.length ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  Belum ada PDF publik yang disimpan.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
