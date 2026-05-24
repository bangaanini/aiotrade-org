"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CloudUpload,
  ExternalLink,
  FileText,
  PlayCircle,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { saveMemberGuidePostAction } from "@/app/(protected)/admin/member-posts/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMemberGuideSectionLabel,
  MEMBER_GUIDE_SECTION_OPTIONS,
  MEMBER_GUIDE_TYPE_OPTIONS,
  type MemberGuideAsset,
  type MemberGuidePost,
  type MemberGuideSection,
  type MemberGuideType,
} from "@/lib/member-guide-types";
import { normalizeMemberGuideVideoUrl } from "@/lib/member-guide-utils";
import { formatIdrCurrency } from "@/lib/payment-gateway-config";
import { cn } from "@/lib/utils";

type MemberGuideComposerViewProps = {
  assets: MemberGuideAsset[];
  cloudinaryEnabled: boolean;
  guides: MemberGuidePost[];
  message?: string;
  selectedGuideId?: string;
  status?: string;
};

type DraftGuide = {
  description: string;
  embedUrl: string;
  fileAssetId: string | null;
  fileUrl: string | null;
  id: string | null;
  isPaid: boolean;
  isPublished: boolean;
  price: string;
  publishedAt: string;
  section: MemberGuideSection;
  sortOrder: number;
  title: string;
  type: MemberGuideType;
};

const EMPTY_GUIDE: DraftGuide = {
  description: "",
  embedUrl: "",
  fileAssetId: null,
  fileUrl: null,
  id: null,
  isPaid: false,
  isPublished: true,
  price: "10000",
  publishedAt: new Date().toISOString().slice(0, 16),
  section: "start",
  sortOrder: 0,
  title: "",
  type: "video",
};

function toDraftGuide(guide: MemberGuidePost | null | undefined): DraftGuide {
  if (!guide) {
    return EMPTY_GUIDE;
  }

  return {
    description: guide.description,
    embedUrl: guide.embedUrl ?? "",
    fileAssetId: guide.fileAssetId,
    fileUrl: guide.fileUrl,
    id: guide.id,
    isPaid: guide.isPaid,
    isPublished: guide.isPublished,
    price: guide.price ? String(guide.price) : "10000",
    publishedAt: guide.publishedAt.slice(0, 16),
    section: guide.section,
    sortOrder: guide.sortOrder,
    title: guide.title,
    type: guide.type,
  };
}

function statusAlert(status?: string, message?: string) {
  switch (status) {
    case "saved":
      return { message: "Materi Pusat Belajar berhasil disimpan.", variant: "success" as const };
    case "invalid":
      return {
        message: message || "Data panduan belum lengkap. Cek lagi form-nya.",
        variant: "error" as const,
      };
    case "error":
      return {
        message: message || "Materi belum bisa disimpan sekarang.",
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

export function MemberGuideComposerView({
  assets,
  cloudinaryEnabled,
  guides,
  message,
  selectedGuideId,
  status,
}: MemberGuideComposerViewProps) {
  const selectedGuide = useMemo(
    () => (selectedGuideId ? guides.find((guide) => guide.id === selectedGuideId) ?? null : null),
    [guides, selectedGuideId],
  );
  const [draft, setDraft] = useState<DraftGuide>(() => toDraftGuide(selectedGuide));
  const [library, setLibrary] = useState(assets);
  const [assetLabel, setAssetLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateDraft<K extends keyof DraftGuide>(key: K, value: DraftGuide[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSection(section: MemberGuideSection) {
    setDraft((current) => ({
      ...current,
      section,
    }));
  }

  function updateType(type: MemberGuideType) {
    setDraft((current) => ({
      ...current,
      type,
      ...(type === "video"
        ? { fileAssetId: null, fileUrl: null }
        : { embedUrl: "" }),
    }));
  }

  function resetComposer() {
    setDraft(EMPTY_GUIDE);
    setUploadError(null);
    setUploadMessage(null);
  }

  async function handlePdfUpload(file: File | null) {
    if (!file) {
      return;
    }

    // Validasi ukuran file maksimal 25 MB
    const maxSizeInBytes = 25 * 1024 * 1024;
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
      const presignedResponse = await fetch("/api/admin/member-guide-assets/presigned-url", {
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
      const confirmResponse = await fetch("/api/admin/member-guide-assets/confirm", {
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

      const payload = (await confirmResponse.json()) as { asset: MemberGuideAsset };
      setLibrary([payload.asset, ...library.filter((asset) => asset.id !== payload.asset.id)]);
      setDraft((current) => ({
        ...current,
        fileAssetId: payload.asset.id,
        fileUrl: payload.asset.secureUrl,
        type: "pdf",
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
  const draftType = draft.type;
  const draftSectionLabel = getMemberGuideSectionLabel(draft.section);
  const previewEmbedUrl = normalizeMemberGuideVideoUrl(draft.embedUrl);

  return (
    <div className="space-y-6">
      {activeAlert ? <Alert variant={activeAlert.variant}>{activeAlert.message}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Pusat Belajar Member</CardTitle>
                  <CardDescription>
                    Buat materi dashboard member untuk menu Mulai, eCourse, AIOTrade, dan Cara Cuan.
                  </CardDescription>
                </div>
                <Button onClick={resetComposer} variant="outline">
                  <PlusCircle className="h-4 w-4" />
                  Materi Baru
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form action={saveMemberGuidePostAction} className="space-y-6">
                <input name="guideId" type="hidden" value={draft.id ?? ""} />
                <input name="section" type="hidden" value={draft.section} />
                <input name="title" type="hidden" value={draft.title} />
                <input name="description" type="hidden" value={draft.description} />
                <input name="embedUrl" type="hidden" value={draft.embedUrl} />
                <input name="fileAssetId" type="hidden" value={draft.fileAssetId ?? ""} />
                <input name="fileUrl" type="hidden" value={draft.fileUrl ?? ""} />
                <input name="sortOrder" type="hidden" value={String(draft.sortOrder)} />
                <input name="publishedAt" type="hidden" value={draft.publishedAt} />
                <input name="isPaid" type="hidden" value={String(draft.isPaid)} />
                <input name="isPublished" type="hidden" value={String(draft.isPublished)} />
                <input name="price" type="hidden" value={draft.isPaid ? draft.price : ""} />
                <input name="type" type="hidden" value={draft.type} />

                <div className="grid gap-3 lg:grid-cols-3">
                  {MEMBER_GUIDE_SECTION_OPTIONS.map((option) => {
                    const active = draft.section === option.value;

                    return (
                      <button
                        className={cn(
                          "rounded-xl border px-4 py-4 text-left transition",
                          active
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 bg-stone-50 hover:bg-stone-100",
                        )}
                        key={option.value}
                        onClick={() => updateSection(option.value)}
                        type="button"
                      >
                        <Sparkles className="h-5 w-5" />
                        <p className="mt-3 text-sm font-semibold">{option.label}</p>
                        <p className={cn("mt-1 text-xs leading-5", active ? "text-white/72" : "text-stone-500")}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {MEMBER_GUIDE_TYPE_OPTIONS.map((option) => {
                    const active = draft.type === option.value;
                    const Icon = option.value === "video" ? PlayCircle : FileText;

                    return (
                      <button
                        className={cn(
                          "rounded-xl border px-4 py-4 text-left transition",
                          active
                            ? "border-sky-900 bg-sky-900 text-white"
                            : "border-stone-200 bg-stone-50 hover:bg-stone-100",
                        )}
                        key={option.value}
                        onClick={() => updateType(option.value)}
                        type="button"
                      >
                        <Icon className="h-5 w-5" />
                        <p className="mt-3 text-sm font-semibold">{option.label}</p>
                        <p className={cn("mt-1 text-xs leading-5", active ? "text-white/72" : "text-stone-500")}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <TextField
                    label="Judul Materi"
                    name="member-guide-title"
                    onChange={(value) => updateDraft("title", value)}
                    placeholder="Mis. Dasar penggunaan AIOTrade"
                    value={draft.title}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="member-guide-order">Urutan Tampil</Label>
                    <Input
                      id="member-guide-order"
                      min={0}
                      onChange={(event) => updateDraft("sortOrder", Number(event.target.value) || 0)}
                      type="number"
                      value={String(draft.sortOrder)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="member-guide-description">Deskripsi Singkat</Label>
                  <textarea
                    className="min-h-28 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                    id="member-guide-description"
                    onChange={(event) => updateDraft("description", event.target.value)}
                    rows={4}
                    value={draft.description}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid gap-2">
                    <Label htmlFor="member-guide-published-at">Tanggal Publish</Label>
                    <Input
                      id="member-guide-published-at"
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">Akses Materi</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        Opsi ini opsional. Aktifkan jika materi hanya boleh dibuka setelah member membayar.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
                      <input
                        checked={draft.isPaid}
                        className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        onChange={(event) => updateDraft("isPaid", event.target.checked)}
                        type="checkbox"
                      />
                      Konten berbayar
                    </label>
                  </div>

                  {draft.isPaid ? (
                    <div className="grid gap-2 lg:max-w-xs">
                      <Label htmlFor="member-guide-price">Nominal Pembayaran</Label>
                      <Input
                        id="member-guide-price"
                        min={1000}
                        onChange={(event) =>
                          updateDraft("price", String(Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0)))
                        }
                        placeholder="10000"
                        type="number"
                        value={draft.price}
                      />
                      <p className="text-xs text-stone-500">
                        Member akan melihat nominal ini saat membuka overlay pembayaran.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">
                      Materi gratis akan langsung bisa diputar atau dibuka oleh semua member.
                    </p>
                  )}
                </div>

                {draftType === "video" ? (
                  <TextField
                    label="Link Embed Video"
                    name="member-guide-embed"
                    onChange={(value) => updateDraft("embedUrl", value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={draft.embedUrl}
                  />
                ) : (
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
                        name="member-guide-asset-label"
                        onChange={setAssetLabel}
                        placeholder="Materi PDF AIOTrade"
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
                            type: "pdf",
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
                )}

                <div className="flex justify-end">
                  <Button type="submit">
                    <Sparkles className="h-4 w-4" />
                    Simpan Materi
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
              <CardDescription>Preview ini meniru tampilan yang akan terlihat di dashboard member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  {draftType === "video" ? <PlayCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {draftSectionLabel}
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                  {draft.title.trim() || "Judul panduan akan tampil di sini"}
                </h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {draft.description.trim() || "Deskripsi singkat panduan akan membantu member memahami isi materi."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em]",
                      draft.isPaid ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    {draft.isPaid ? "Berbayar" : "Gratis"}
                  </span>
                  {draft.isPaid ? (
                    <span className="inline-flex items-center rounded-full bg-stone-900 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white">
                      {formatIdrCurrency(Number.parseInt(draft.price || "0", 10) || 0)}
                    </span>
                  ) : null}
                </div>
                {draftType === "video" ? (
                  previewEmbedUrl ? (
                    <div className="relative mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-black">
                      <div className="aspect-video w-full">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className={cn("h-full w-full", draft.isPaid ? "pointer-events-none opacity-35 blur-[1.5px]" : "")}
                          src={previewEmbedUrl}
                          title={draft.title || "Preview Video Panduan"}
                        />
                      </div>
                      {draft.isPaid ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-stone-950/55 p-5">
                          <div className="max-w-sm rounded-2xl bg-white/95 px-5 py-5 text-center shadow-xl backdrop-blur">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Overlay pembayaran</p>
                            <p className="mt-3 text-lg font-semibold text-stone-950">
                              Member perlu membayar {formatIdrCurrency(Number.parseInt(draft.price || "0", 10) || 0)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-stone-600">
                              Setelah pembayaran berhasil, video akan terbuka dan bisa diputar dari dashboard member.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                      Masukkan link YouTube atau Vimeo untuk melihat preview video.
                    </div>
                  )
                ) : draft.fileUrl ? (
                  <div className="relative mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-rose-100 p-3 text-rose-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">
                            {draft.title.trim() || "Dokumen panduan"}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            PDF akan dibuka di tab baru saat member mengklik dokumen ini.
                          </p>
                        </div>
                      </div>
                      <Link
                        className={cn(
                          "inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 transition hover:bg-stone-50",
                          draft.isPaid ? "pointer-events-none opacity-25" : "",
                        )}
                        href={draft.isPaid ? "#" : draft.fileUrl}
                        target={draft.isPaid ? undefined : "_blank"}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Buka PDF
                      </Link>
                    </div>
                    {draft.isPaid ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/78 p-5 backdrop-blur-sm">
                        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white px-5 py-5 text-center shadow-lg">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Overlay pembayaran</p>
                          <p className="mt-3 text-lg font-semibold text-stone-950">
                            PDF terkunci sampai member membayar {formatIdrCurrency(Number.parseInt(draft.price || "0", 10) || 0)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                    Upload atau pilih PDF untuk melihat preview dokumen.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daftar Materi</CardTitle>
              <CardDescription>Pilih materi yang sudah ada untuk diedit kembali.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {guides.map((guide) => {
                const active = draft.id === guide.id;

                return (
                  <button
                    className={cn(
                      "w-full rounded-xl border px-4 py-4 text-left transition",
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-stone-50 hover:bg-stone-100",
                    )}
                    key={guide.id}
                    onClick={() => setDraft(toDraftGuide(guide))}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{guide.title}</p>
                        <p className={cn("mt-2 text-xs", active ? "text-white/70" : "text-stone-500")}>
                          {getMemberGuideSectionLabel(guide.section)} • Urutan {guide.sortOrder}
                        </p>
                        <p className={cn("mt-1 text-[0.72rem] font-medium uppercase tracking-[0.14em]", active ? "text-white/72" : "text-stone-400")}>
                          {guide.isPaid && guide.price ? `Berbayar • ${formatIdrCurrency(guide.price)}` : "Gratis"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold uppercase",
                          guide.isPublished
                            ? active
                              ? "bg-white/16 text-white"
                              : "bg-emerald-100 text-emerald-700"
                            : active
                              ? "bg-white/14 text-white/78"
                              : "bg-stone-200 text-stone-700",
                        )}
                      >
                        {guide.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!guides.length ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                  Belum ada materi Pusat Belajar. Mulai dari composer di kiri.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
