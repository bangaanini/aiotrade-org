"use client";

import { type CSSProperties, useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Lock,
  LockKeyhole,
  PlayCircle,
  QrCode,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  memberGlassPanelClass,
  MemberPageHeader,
  memberSoftButtonClass,
  memberSolidButtonClass,
  memberTextMutedClass,
  memberTextPrimaryClass,
  memberTextSecondaryClass,
} from "@/components/dashboard/member-ui";
import type { MemberGuidePaymentPublicState } from "@/lib/member-guide-payment-types";
import type { MemberGuidePost } from "@/lib/member-guide-types";
import { formatIdrCurrency } from "@/lib/payment-gateway-config";
import type { PublicSignupPaymentSettings } from "@/lib/payment-gateway-types";

type MemberLearningGuideSectionProps = {
  badge: string;
  description: string;
  emptyMessage: string;
  guides: MemberGuidePost[];
  labels?: Partial<GuideSectionLabels>;
  paymentSettings: PublicSignupPaymentSettings;
  title: string;
};

type GuideSectionLabels = {
  actionCreatePayment: string;
  actionClosePayment: string;
  actionOpenUnlock: string;
  actionOpenPaymentPage: string;
  actionRefreshPayment: string;
  freeAccess: string;
  listDescription: string;
  listTitle: string;
  lockedDescription: string;
  lockedTitle: string;
  openPdf: string;
  nowPlaying: string;
  paymentDisabled: string;
  paymentMethod: string;
  paymentModalDescription: string;
  paymentModalTitle: string;
  paymentPending: string;
  paymentReady: string;
  paymentReference: string;
  paymentSuccess: string;
  pdfDescription: string;
  pdfTitle: string;
  priceLabel: string;
  sectionDescription: string;
  unlockSuccess: string;
  videoTitle: string;
};

function getGuideBadgeStyle(guide: MemberGuidePost, unlocked: boolean): CSSProperties {
  return {
    backgroundColor: guide.isPaid
      ? unlocked
        ? "#bbf7d0"
        : "#fef3c7"
      : "#dff4ff",
    color: "#0f172a",
    textShadow: "none",
  };
}

type GuidePaymentFlowState = {
  message: string | null;
  payment: MemberGuidePaymentPublicState | null;
  referenceId: string | null;
  selectedChannelCode: string;
  status: "idle" | "creating" | "pending" | "paid" | "error";
};

function paymentChannelIcon(type: PublicSignupPaymentSettings["activeChannels"][number]["type"]) {
  if (type === "qris") {
    return QrCode;
  }

  if (type === "ewallet") {
    return Wallet;
  }

  return Landmark;
}

function createDefaultFlow(paymentSettings: PublicSignupPaymentSettings): GuidePaymentFlowState {
  return {
    message: null,
    payment: null,
    referenceId: null,
    selectedChannelCode:
      paymentSettings.defaultChannelCode ?? paymentSettings.activeChannels[0]?.code ?? "",
    status: "idle",
  };
}

function GuidePaymentOverlay({
  compact = false,
  flow,
  guide,
  labels,
  onChannelChange,
  onCreatePayment,
  onRefreshPayment,
  paymentSettings,
}: {
  compact?: boolean;
  flow: GuidePaymentFlowState;
  guide: MemberGuidePost;
  labels: GuideSectionLabels;
  onChannelChange: (guideId: string, channelCode: string) => void;
  onCreatePayment: (guideId: string) => Promise<void>;
  onRefreshPayment: (guideId: string) => Promise<void>;
  paymentSettings: PublicSignupPaymentSettings;
}) {
  const currentChannel =
    paymentSettings.activeChannels.find(
      (channel) =>
        channel.code === (flow.payment?.channelCode ?? flow.selectedChannelCode),
    ) ?? paymentSettings.activeChannels[0];

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border bg-[var(--member-premium-overlay-surface)] shadow-[var(--member-premium-overlay-shadow)] backdrop-blur-xl ${
        compact ? "w-full p-4" : "mx-auto w-full max-w-[44rem] p-5 sm:p-6"
      }`}
      style={{ borderColor: "var(--member-premium-overlay-border)" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.12),transparent_34%)]" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.2em]"
            style={{
              background: "var(--member-premium-badge-bg)",
              color: "var(--member-premium-badge-text)",
            }}
          >
            <Lock className="h-3.5 w-3.5" />
            {labels.lockedTitle}
          </div>
          <h3 className={`mt-3 text-xl font-semibold tracking-tight ${memberTextPrimaryClass}`}>
            {guide.title}
          </h3>
          <p className={`mt-2 text-sm leading-7 ${memberTextSecondaryClass}`}>
            {labels.lockedDescription}
          </p>
        </div>

        <div
          className="relative z-10 rounded-2xl px-4 py-3 text-right shadow-lg"
          style={{
            background: "var(--member-premium-price-bg)",
            color: "var(--member-premium-price-text)",
          }}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] opacity-70">
            {labels.priceLabel}
          </p>
          <p className="mt-2 text-lg font-semibold">
            {formatIdrCurrency(guide.price ?? 0)}
          </p>
        </div>
      </div>

      {!paymentSettings.isEnabled || !paymentSettings.activeChannels.length ? (
        <div
          className="relative z-10 mt-4 rounded-2xl border px-4 py-3 text-sm"
          style={{
            background: "var(--member-premium-status-error-bg)",
            borderColor: "var(--member-premium-status-error-border)",
            color: "var(--member-premium-status-error-text)",
          }}
        >
          {labels.paymentDisabled}
        </div>
      ) : (
        <div className="relative z-10 mt-5 space-y-4">
          <div>
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.2em] ${memberTextMutedClass}`}>
              {labels.paymentMethod}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {paymentSettings.activeChannels.map((channel) => {
                const active =
                  channel.code === (flow.payment?.channelCode ?? flow.selectedChannelCode);
                const Icon = paymentChannelIcon(channel.type);

                return (
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? "text-[var(--member-text-primary)]"
                        : "border-[var(--member-border)] bg-[var(--member-card)] text-[var(--member-text-primary)]"
                    }`}
                    key={channel.code}
                    onClick={() => onChannelChange(guide.id, channel.code)}
                    style={
                      active
                        ? {
                            background: "var(--member-premium-active-channel-bg)",
                            borderColor: "var(--member-premium-active-channel-border)",
                            boxShadow: "var(--member-premium-active-channel-shadow)",
                          }
                        : undefined
                    }
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{channel.name}</p>
                        <p className={`mt-1 text-[0.72rem] uppercase tracking-[0.18em] ${memberTextMutedClass}`}>
                          {channel.type}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--member-row-border)] bg-[var(--member-card)] px-4 py-3">
              <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${memberTextMutedClass}`}>
                Tujuan pembayaran atas nama
              </p>
              <p className={`mt-2 text-sm font-semibold ${memberTextPrimaryClass}`}>
                PT LIMBUNGAN MEDIA SOLUSI
              </p>
            </div>
          </div>

          {flow.message ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={
                flow.status === "paid"
                  ? {
                      background: "var(--member-premium-status-success-bg)",
                      borderColor: "var(--member-premium-status-success-border)",
                      color: "var(--member-premium-status-success-text)",
                    }
                  : flow.status === "error"
                    ? {
                        background: "var(--member-premium-status-error-bg)",
                        borderColor: "var(--member-premium-status-error-border)",
                        color: "var(--member-premium-status-error-text)",
                      }
                    : {
                        background: "var(--member-premium-status-info-bg)",
                        borderColor: "var(--member-premium-status-info-border)",
                        color: "var(--member-premium-status-info-text)",
                      }
              }
            >
              {flow.message}
            </div>
          ) : null}

          <div className={`flex flex-wrap gap-3 ${compact ? "" : "items-center"}`}>
            <button
              className={`${memberSolidButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={
                !currentChannel ||
                !paymentSettings.isEnabled ||
                flow.status === "creating" ||
                flow.status === "paid"
              }
              onClick={() => onCreatePayment(guide.id)}
              type="button"
            >
              {flow.status === "creating" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {labels.actionCreatePayment}
            </button>

            {flow.referenceId ? (
              <button
                className={memberSoftButtonClass}
                onClick={() => onRefreshPayment(guide.id)}
                type="button"
              >
                <ShieldCheck className="h-4 w-4" />
                {labels.actionRefreshPayment}
              </button>
            ) : null}
          </div>

          {flow.payment ? (
            <div className="rounded-[24px] border border-[var(--member-border)] bg-[var(--member-card)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${memberTextMutedClass}`}>
                    {flow.status === "paid"
                      ? labels.paymentSuccess
                      : flow.status === "error"
                        ? "Pembayaran gagal"
                        : labels.paymentPending}
                  </p>
                  <p className={`mt-2 text-sm leading-7 ${memberTextSecondaryClass}`}>
                    {labels.paymentReference}: {flow.payment.referenceId}
                  </p>
                </div>
                <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-[var(--member-text-primary)] dark:bg-white/10">
                  {formatIdrCurrency(flow.payment.amount)}
                </div>
              </div>

              {flow.payment.qrImageUrl ? (
                <div className="mt-4 flex justify-center">
                  <div
                    className="h-44 w-44 rounded-3xl border border-[var(--member-border)] bg-white bg-contain bg-center bg-no-repeat p-3"
                    style={{ backgroundImage: `url(${flow.payment.qrImageUrl})` }}
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-black/5 px-4 py-3 dark:bg-white/5">
                  <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${memberTextMutedClass}`}>
                    Channel
                  </p>
                  <p className={`mt-2 text-sm font-semibold ${memberTextPrimaryClass}`}>
                    {flow.payment.paymentName ?? currentChannel?.name ?? flow.payment.channelCode}
                  </p>
                </div>
                {flow.payment.paymentNumber ? (
                  <div className="rounded-2xl bg-black/5 px-4 py-3 dark:bg-white/5">
                    <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${memberTextMutedClass}`}>
                      Nomor bayar
                    </p>
                    <p className={`mt-2 break-all text-sm font-semibold ${memberTextPrimaryClass}`}>
                      {flow.payment.paymentNumber}
                    </p>
                  </div>
                ) : null}
              </div>

              
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}

function GuideUnlockPrompt({
  compact = false,
  guide,
  labels,
  onOpenPayment,
}: {
  compact?: boolean;
  guide: MemberGuidePost;
  labels: GuideSectionLabels;
  onOpenPayment: (guideId: string) => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border shadow-[var(--member-premium-overlay-shadow)] backdrop-blur-xl ${
        compact ? "w-full px-4 py-4" : "px-5 py-5 sm:px-6"
      }`}
      style={{
        background: "var(--member-premium-overlay-surface)",
        borderColor: "var(--member-premium-overlay-border)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.1),transparent_40%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.12),transparent_30%)]" />
      <div className="relative">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: "var(--member-premium-badge-bg)",
            color: "var(--member-premium-badge-text)",
          }}
        >
          <Lock className="h-3.5 w-3.5" />
          {labels.lockedTitle}
        </div>

        <h3 className={`${compact ? "mt-2 text-base" : "mt-3 text-lg"} font-semibold tracking-tight ${memberTextPrimaryClass}`}>
          {guide.title}
        </h3>
        <p className={`${compact ? "mt-2 text-[0.92rem] leading-6" : "mt-2 text-sm leading-6"} ${memberTextSecondaryClass}`}>
          {labels.lockedDescription}
        </p>

        <div className={`${compact ? "mt-3 flex flex-col gap-3 sm:flex-row sm:items-center" : "mt-4 flex flex-wrap items-center gap-3"}`}>
          <div
            className={`${compact ? "w-full sm:w-auto" : ""} rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg`}
            style={{
              background: "var(--member-premium-price-bg)",
              color: "var(--member-premium-price-text)",
            }}
          >
            <p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-70">
              {labels.priceLabel}
            </p>
            <p className="mt-1 text-base">{formatIdrCurrency(guide.price ?? 0)}</p>
          </div>

          <button
            className={`${memberSolidButtonClass} ${compact ? "w-full sm:w-auto" : ""}`}
            onClick={() => onOpenPayment(guide.id)}
            type="button"
          >
            <LockKeyhole className="h-4 w-4" />
            {labels.actionOpenUnlock}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MemberLearningGuideSection({
  badge,
  description,
  emptyMessage,
  guides,
  labels: labelsProp,
  paymentSettings,
  title,
}: MemberLearningGuideSectionProps) {
  const labels: GuideSectionLabels = {
    actionCreatePayment: "Buat pembayaran",
    actionClosePayment: "Tutup",
    actionOpenUnlock: "Unlock sekarang",
    actionOpenPaymentPage: "Buka halaman pembayaran",
    actionRefreshPayment: "Cek status pembayaran",
    freeAccess: "Gratis",
    listDescription: "Semua materi yang masuk kategori ini akan muncul di sini.",
    listTitle: "Daftar video",
    lockedDescription:
      "Materi ini terkunci. Pilih metode pembayaran di bawah untuk membuka akses.",
    lockedTitle: "Akses premium",
    openPdf: "Buka PDF",
    nowPlaying: "Sedang diputar",
    paymentDisabled: "Pembayaran konten sedang tidak tersedia. Hubungi admin untuk bantuan manual.",
    paymentMethod: "Metode pembayaran",
    paymentModalDescription:
      "Pilih metode pembayaran untuk membuka akses materi ini.",
    paymentModalTitle: "Buka akses premium",
    paymentPending: "Pembayaran menunggu penyelesaian",
    paymentReady: "Pembayaran siap diproses",
    paymentReference: "Reference",
    paymentSuccess: "Pembayaran berhasil",
    pdfDescription:
      "Dokumen PDF akan muncul di sini jika admin menambahkan materi tertulis untuk kategori ini.",
    pdfTitle: "Materi PDF",
    priceLabel: "Harga akses",
    sectionDescription:
      "Pilih materi di samping untuk melihat preview utama dan mulai belajar lebih cepat.",
    unlockSuccess: "Pembayaran berhasil. Materi sudah terbuka.",
    videoTitle: "Video panduan",
    ...labelsProp,
  };
  const videoGuides = useMemo(
    () => guides.filter((guide) => guide.type === "video"),
    [guides],
  );
  const pdfGuides = useMemo(
    () => guides.filter((guide) => guide.type === "pdf"),
    [guides],
  );
  const [selectedVideoId, setSelectedVideoId] = useState(videoGuides[0]?.id ?? null);
  const [activePaymentGuideId, setActivePaymentGuideId] = useState<string | null>(null);
  const [unlockedGuideIds, setUnlockedGuideIds] = useState<string[]>(
    () => guides.filter((guide) => guide.isUnlocked).map((guide) => guide.id),
  );
  const [paymentFlows, setPaymentFlows] = useState<Record<string, GuidePaymentFlowState>>({});
  const selectedVideo =
    videoGuides.find((guide) => guide.id === selectedVideoId) ?? videoGuides[0] ?? null;
  const activePaymentGuide =
    guides.find((guide) => guide.id === activePaymentGuideId) ?? null;

  function isGuideUnlocked(guide: MemberGuidePost) {
    return !guide.isPaid || unlockedGuideIds.includes(guide.id);
  }

  function resolveFlow(guideId: string) {
    return paymentFlows[guideId] ?? createDefaultFlow(paymentSettings);
  }

  function updateFlow(guideId: string, updater: (current: GuidePaymentFlowState) => GuidePaymentFlowState) {
    setPaymentFlows((current) => ({
      ...current,
      [guideId]: updater(current[guideId] ?? createDefaultFlow(paymentSettings)),
    }));
  }

  function markUnlocked(guideId: string) {
    setUnlockedGuideIds((current) =>
      current.includes(guideId) ? current : [...current, guideId],
    );
  }

  function openPaymentModal(guideId: string) {
    setActivePaymentGuideId(guideId);
  }

  function closePaymentModal() {
    setActivePaymentGuideId(null);
  }

  async function createPayment(guideId: string) {
    const flow = resolveFlow(guideId);

    updateFlow(guideId, (current) => ({
      ...current,
      message: null,
      payment: null,
      referenceId: null,
      status: "creating",
    }));

    try {
      const response = await fetch("/api/member-guides/payment/create", {
        body: JSON.stringify({
          channelCode: flow.selectedChannelCode,
          guideId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        payment?: MemberGuidePaymentPublicState;
        unlocked?: boolean;
      } | null;

      if (response.status === 409 && payload?.unlocked) {
        markUnlocked(guideId);
        closePaymentModal();
        updateFlow(guideId, (current) => ({
          ...current,
          message: payload.message ?? labels.unlockSuccess,
          status: "paid",
        }));
        return;
      }

      if (!response.ok || !payload?.payment) {
        throw new Error(payload?.message ?? "Belum bisa membuat pembayaran sekarang.");
      }

      const payment = payload.payment;

      if (payment.unlocked || payment.status === "paid") {
        markUnlocked(guideId);
        closePaymentModal();
      }

      updateFlow(guideId, (current) => ({
        ...current,
        message:
          payment.unlocked || payment.status === "paid"
            ? labels.unlockSuccess
            : payment.message ?? labels.paymentReady,
        payment,
        referenceId: payment.referenceId,
        status:
          payment.unlocked || payment.status === "paid"
            ? "paid"
            : payment.status === "failed"
              ? "error"
              : payment.status,
      }));
    } catch (error) {
      updateFlow(guideId, (current) => ({
        ...current,
        message:
          error instanceof Error ? error.message : "Belum bisa membuat pembayaran sekarang.",
        payment: null,
        referenceId: null,
        status: "error",
      }));
    }
  }

  async function refreshPayment(guideId: string) {
    const flow = resolveFlow(guideId);

    if (!flow.referenceId) {
      return;
    }

    updateFlow(guideId, (current) => ({
      ...current,
      message: null,
      status: current.status === "paid" ? "paid" : "pending",
    }));

    try {
      const response = await fetch(
        `/api/member-guides/payment/status?referenceId=${encodeURIComponent(flow.referenceId)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        payment?: MemberGuidePaymentPublicState;
      } | null;

      if (!response.ok || !payload?.payment) {
        throw new Error(payload?.message ?? "Belum bisa memeriksa status pembayaran.");
      }

      const payment = payload.payment;

      if (payment.unlocked || payment.status === "paid") {
        markUnlocked(guideId);
        closePaymentModal();
      }

      updateFlow(guideId, (current) => ({
        ...current,
        message:
          payment.unlocked || payment.status === "paid"
            ? labels.unlockSuccess
            : payment.message ?? labels.paymentPending,
        payment,
        referenceId: payment.referenceId,
        status:
          payment.unlocked || payment.status === "paid"
            ? "paid"
            : payment.status === "failed"
              ? "error"
              : payment.status,
      }));
    } catch (error) {
      updateFlow(guideId, (current) => ({
        ...current,
        message:
          error instanceof Error ? error.message : "Belum bisa memeriksa status pembayaran.",
        status: current.payment ? current.status : "error",
      }));
    }
  }

  function updateSelectedChannel(guideId: string, channelCode: string) {
    updateFlow(guideId, (current) => ({
      ...current,
      selectedChannelCode: channelCode,
    }));
  }

  const refreshPaymentEvent = useEffectEvent((guideId: string) => {
    void refreshPayment(guideId);
  });

  useEffect(() => {
    if (!activePaymentGuideId) {
      return;
    }

    const flow = paymentFlows[activePaymentGuideId];

    if (!flow?.referenceId || flow.status !== "pending") {
      return;
    }

    const timer = window.setInterval(() => {
      refreshPaymentEvent(activePaymentGuideId);
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activePaymentGuideId, paymentFlows]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
      <MemberPageHeader
        badge={badge}
        description={description}
        icon={BookOpen}
        title={title}
        toneClassName="bg-[linear-gradient(135deg,rgba(59,130,246,0.12)_0%,rgba(255,255,255,0)_44%,rgba(16,185,129,0.1)_100%)]"
      />

      {!guides.length ? (
        <div className={`px-6 py-8 text-sm ${memberTextSecondaryClass} ${memberGlassPanelClass}`}>
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-6">
          {videoGuides.length ? (
            <section className="space-y-4">
              <div className="px-1">
                <h2 className={`text-[1.7rem] font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                  {labels.videoTitle}
                </h2>
                <p className={`mt-1 text-sm leading-7 ${memberTextSecondaryClass}`}>
                  {labels.sectionDescription}
                </p>
              </div>

              {selectedVideo ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
                  <div className={`overflow-hidden ${memberGlassPanelClass}`}>
                    {isGuideUnlocked(selectedVideo) ? (
                      <div className="aspect-video overflow-hidden bg-[var(--member-video-frame-bg)]">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full"
                          src={selectedVideo.embedUrl ?? undefined}
                          title={selectedVideo.title}
                        />
                      </div>
                    ) : (
                      <div className="relative aspect-video overflow-hidden bg-[var(--member-video-frame-bg)]">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full scale-[1.02] opacity-30 blur-[2px]"
                          src={selectedVideo.embedUrl ?? undefined}
                          title={selectedVideo.title}
                        />
                        <div
                          className="absolute inset-0 overflow-y-auto p-4 sm:p-5"
                          style={{ background: "var(--member-premium-overlay-backdrop)" }}
                        >
                          <div className="flex min-h-full items-start justify-center py-1 sm:items-center sm:py-3">
                            <GuideUnlockPrompt
                              guide={selectedVideo}
                              labels={labels}
                              onOpenPayment={openPaymentModal}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="px-6 py-6 sm:px-7">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.24em] ${memberTextMutedClass}`}>
                          {isGuideUnlocked(selectedVideo) ? labels.nowPlaying : labels.lockedTitle}
                        </p>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em]"
                          style={getGuideBadgeStyle(selectedVideo, isGuideUnlocked(selectedVideo))}
                        >
                          {selectedVideo.isPaid
                            ? isGuideUnlocked(selectedVideo)
                              ? "Sudah dibuka"
                              : formatIdrCurrency(selectedVideo.price ?? 0)
                            : labels.freeAccess}
                        </span>
                      </div>
                      <h3 className={`mt-3 text-[1.6rem] font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                        {selectedVideo.title}
                      </h3>
                      <p className={`mt-3 text-sm leading-7 ${memberTextSecondaryClass}`}>
                        {selectedVideo.description}
                      </p>
                    </div>
                  </div>

                  <div className={`flex flex-col px-5 py-5 ${memberGlassPanelClass}`}>
                    <div className="px-1">
                      <h3 className={`text-[1.35rem] font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                        {labels.listTitle}
                      </h3>
                      <p className={`mt-1 text-sm leading-7 ${memberTextSecondaryClass}`}>
                        {labels.listDescription}
                      </p>
                    </div>

                    <div className="mt-5 max-h-[600px] space-y-3 overflow-y-auto pr-2">
                      {videoGuides.map((guide) => {
                        const active = guide.id === selectedVideo.id;
                        const unlocked = isGuideUnlocked(guide);

                        return (
                          <button
                            className={`w-full rounded-[24px] px-4 py-4 text-left transition duration-300 ${
                              active
                                ? "text-[var(--member-text-primary)] dark:text-[var(--member-sidebar-active-text)]"
                                : "member-row-surface text-[var(--member-text-primary)]"
                            }`}
                            key={guide.id}
                            onClick={() => setSelectedVideoId(guide.id)}
                            style={
                              active
                                ? {
                                    background: "var(--member-sidebar-active-bg)",
                                    boxShadow: "var(--member-sidebar-active-shadow)",
                                  }
                                : undefined
                            }
                            type="button"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                  active
                                    ? "bg-sky-500/12 text-sky-800 dark:bg-sky-100/50 dark:text-[var(--member-sidebar-active-text)]"
                                    : "member-icon-surface"
                                }`}
                              >
                                {guide.isPaid && !unlocked ? (
                                  <Lock className="h-5 w-5" />
                                ) : (
                                  <PlayCircle className="h-5 w-5" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={`text-sm font-semibold ${active ? `${memberTextPrimaryClass} dark:text-[var(--member-sidebar-active-text)]` : ""}`}>
                                    {guide.title}
                                  </p>
                                  <span
                                    className="rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.14em]"
                                    style={getGuideBadgeStyle(guide, unlocked)}
                                  >
                                    {guide.isPaid
                                      ? unlocked
                                        ? "Unlocked"
                                        : formatIdrCurrency(guide.price ?? 0)
                                      : labels.freeAccess}
                                  </span>
                                </div>
                                <p
                                  className={`mt-2 text-xs leading-6 ${
                                    active
                                      ? `${memberTextSecondaryClass} dark:text-[var(--member-sidebar-active-text)]`
                                      : memberTextMutedClass
                                  }`}
                                >
                                  {guide.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {pdfGuides.length ? (
            <section className="space-y-4">
              <div className="px-1">
                <h2 className={`text-[1.7rem] font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                  {labels.pdfTitle}
                </h2>
                <p className={`mt-1 text-sm leading-7 ${memberTextSecondaryClass}`}>
                  {labels.pdfDescription}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {pdfGuides.map((guide) => {
                  const unlocked = isGuideUnlocked(guide);

                  return (
                    <div
                      className={`relative flex min-h-[280px] flex-col gap-5 overflow-hidden px-6 py-6 sm:min-h-[300px] lg:min-h-[320px] ${memberGlassPanelClass}`}
                      key={guide.id}
                    >
                      <div className={`flex h-full flex-col ${guide.isPaid && !unlocked ? "pointer-events-none opacity-40 blur-[1px]" : ""}`}>
                        <div className="flex items-start gap-4">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-800">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={`text-[1.35rem] font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                                {guide.title}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${
                                  guide.isPaid
                                    ? unlocked
                                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                                      : "bg-amber-500/12 text-amber-700 dark:text-amber-200"
                                    : "bg-sky-500/12 text-sky-700 dark:text-sky-200"
                                }`}
                              >
                                {guide.isPaid
                                  ? unlocked
                                    ? "Unlocked"
                                    : formatIdrCurrency(guide.price ?? 0)
                                  : labels.freeAccess}
                              </span>
                            </div>
                            <p className={`mt-3 text-sm leading-7 ${memberTextSecondaryClass}`}>
                              {guide.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <Link
                            className={memberSoftButtonClass}
                            href={guide.fileUrl ?? "#"}
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {labels.openPdf}
                          </Link>
                        </div>
                      </div>

                      {guide.isPaid && !unlocked ? (
                        <div
                          className="absolute inset-0 p-4 backdrop-blur-md sm:p-5"
                          style={{ background: "var(--member-premium-overlay-backdrop)" }}
                        >
                          <div className="flex h-full items-stretch">
                            <GuideUnlockPrompt
                              compact
                              guide={guide}
                              labels={labels}
                              onOpenPayment={openPaymentModal}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {activePaymentGuide ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label={labels.actionClosePayment}
            className="absolute inset-0 backdrop-blur-sm"
            onClick={closePaymentModal}
            style={{ background: "var(--member-premium-modal-backdrop)" }}
            type="button"
          />

          <div
            className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border shadow-[var(--member-premium-modal-shadow)]"
            style={{
              background: "var(--member-premium-modal-surface)",
              borderColor: "var(--member-premium-modal-border)",
            }}
          >
            <div
              className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
              style={{
                background: "var(--member-premium-modal-header-surface)",
                borderColor: "var(--member-premium-modal-divider)",
              }}
            >
              <div>
                <p className="member-page-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  {labels.paymentModalTitle}
                </p>
                <h3 className={`mt-3 text-xl font-semibold tracking-tight ${memberTextPrimaryClass}`}>
                  {activePaymentGuide.title}
                </h3>
                <p className={`mt-2 max-w-2xl text-sm leading-7 ${memberTextSecondaryClass}`}>
                  {labels.paymentModalDescription}
                </p>
              </div>

              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-[var(--member-text-primary)] transition hover:-translate-y-0.5"
                onClick={closePaymentModal}
                style={{
                  background: "var(--member-premium-modal-close-bg)",
                  borderColor: "var(--member-premium-modal-close-border)",
                  boxShadow: "var(--member-premium-modal-close-shadow)",
                }}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <GuidePaymentOverlay
                flow={resolveFlow(activePaymentGuide.id)}
                guide={activePaymentGuide}
                labels={labels}
                onChannelChange={updateSelectedChannel}
                onCreatePayment={createPayment}
                onRefreshPayment={refreshPayment}
                paymentSettings={paymentSettings}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MemberVideoGuideSection({
  badge,
  description,
  emptyMessage,
  guides,
  labels,
  paymentSettings,
  title,
}: Omit<MemberLearningGuideSectionProps, "paymentSettings"> & {
  paymentSettings: PublicSignupPaymentSettings;
}) {
  return (
    <MemberLearningGuideSection
      badge={badge}
      description={description}
      emptyMessage={emptyMessage}
      guides={guides.filter((guide) => guide.type === "video")}
      labels={labels}
      paymentSettings={paymentSettings}
      title={title}
    />
  );
}

export function MemberPdfGuideSection({
  badge,
  description,
  emptyMessage,
  guides,
  labels,
  paymentSettings,
  title,
}: Omit<MemberLearningGuideSectionProps, "paymentSettings"> & {
  paymentSettings: PublicSignupPaymentSettings;
}) {
  return (
    <MemberLearningGuideSection
      badge={badge}
      description={description}
      emptyMessage={emptyMessage}
      guides={guides.filter((guide) => guide.type === "pdf")}
      labels={labels}
      paymentSettings={paymentSettings}
      title={title}
    />
  );
}
