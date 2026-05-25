"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import QRCodeLib from "qrcode";
import {
  AlertCircle,
  ArrowUpRight,
  AtSign,
  CheckCircle2,
  Circle,
  Copy,
  CreditCard,
  KeyRound,
  LoaderCircle,
  Mail,
  MessageCircleMore,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { signUpAction, type SignupActionState } from "@/app/(auth)/signup/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { AuthFieldShell } from "@/components/auth/auth-field-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdrCurrency } from "@/lib/payment-gateway-config";
import type { PublicSignupPaymentSettings } from "@/lib/payment-gateway-types";
import type { SignupPaymentPublicState } from "@/lib/signup-payment-types";
import { cn } from "@/lib/utils";
import { getUsernameValidationMessage } from "@/lib/username-rules";

type SignupFormProps = {
  labels?: {
    accountReady: string;
    backToLogin: string;
    createAccount: string;
    createPayment: string;
    createPaymentAgain: string;
    createPaymentPending: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordCheckDescriptionEmpty: string;
    passwordCheckDescriptionMatch: string;
    passwordCheckDescriptionStrong: string;
    passwordCheckTitle: string;
    passwordConfirmation: string;
    passwordConfirmationPlaceholder: string;
    passwordLengthLabel: string;
    passwordPlaceholder: string;
    payment: string;
    paymentMethod: string;
    paymentStepDescription: string;
    paymentStepTitle: string;
    signupLocked: string;
    subscriptionDuration: string;
    username: string;
    usernamePlaceholder: string;
    usernameStatusAvailable: string;
    usernameStatusChecking: string;
    usernameStatusError: string;
    usernameStatusGuidance: string;
    usernameStatusTaken: string;
    whatsapp: string;
    whatsappPlaceholder: string;
  };
  paymentSettings: PublicSignupPaymentSettings;
};

type UsernameAvailability =
  | {
      status: "idle";
      value: string;
      message: string | null;
    }
  | {
      status: "checking" | "available" | "taken" | "error";
      value: string;
      message: string;
    };

type PaymentFlowState = {
  fingerprint: string | null;
  message: string | null;
  payment: SignupPaymentPublicState | null;
  referenceId: string | null;
  status: "idle" | "creating" | "pending" | "paid" | "failed" | "error";
};

type PaymentInstructionKind = "qris" | "bank" | "link";

const initialSignupState: SignupActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

const defaultLabels = {
  accountReady: "Sudah punya akun?",
  backToLogin: "Masuk di sini",
  createAccount: "Buat akun",
  createPayment: "Buat pembayaran",
  createPaymentAgain: "Buat ulang pembayaran",
  createPaymentPending: "Sedang membuat akun...",
  email: "Email",
  emailPlaceholder: "you@example.com",
  password: "Password",
  passwordCheckDescriptionEmpty: "Mulai ketik password untuk melihat kekuatannya.",
  passwordCheckDescriptionMatch: "Password sudah cocok dan siap dipakai.",
  passwordCheckDescriptionStrong: "Tambahkan kombinasi yang lebih beragam agar password lebih kuat.",
  passwordCheckTitle: "Cek password Anda",
  passwordConfirmation: "Ulangi Password",
  passwordConfirmationPlaceholder: "Ketik ulang password",
  passwordLengthLabel: "karakter",
  passwordPlaceholder: "Minimal 8 karakter",
  payment: "Payment",
  paymentMethod: "Metode pembayaran",
  paymentStepDescription: "Lengkapi form dan buat pembayaran.",
  paymentStepTitle: "Langkah pembayaran",
  signupLocked: "Selesaikan pembayaran dulu",
  subscriptionDuration: "Pilih durasi langganan",
  username: "Username",
  usernamePlaceholder: "yourname",
  usernameStatusAvailable: "Username ini masih tersedia.",
  usernameStatusChecking: "Sedang memeriksa username...",
  usernameStatusError: "Belum bisa memeriksa username sekarang.",
  usernameStatusGuidance: "Pakai 3-24 huruf kecil, angka, atau underscore.",
  usernameStatusTaken: "Username ini sudah dipakai.",
  whatsapp: "Nomor WhatsApp",
  whatsappPlaceholder: "+6281234567890",
};

function ChecklistItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  const Icon = done ? CheckCircle2 : Circle;

  return (
    <div className={cn("flex items-center gap-2 text-sm", done ? "text-emerald-700" : "text-slate-500")}>
      <Icon className={cn("h-4 w-4 shrink-0", done ? "fill-emerald-100" : "")} />
      <span>{label}</span>
    </div>
  );
}

function paymentChannelIcon(type: PublicSignupPaymentSettings["activeChannels"][number]["type"]) {
  if (type === "ewallet") {
    return Wallet;
  }

  if (type === "qris") {
    return QrCode;
  }

  return CreditCard;
}

function paymentInstructionKind(
  channelType: PublicSignupPaymentSettings["activeChannels"][number]["type"] | undefined,
  payment: SignupPaymentPublicState | null,
): PaymentInstructionKind {
  if (channelType === "qris" || payment?.qrImageUrl || payment?.qrString) {
    return "qris";
  }

  if (channelType === "va" || payment?.paymentNumber) {
    return "bank";
  }

  return "link";
}

function subscribeHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

export function SignupForm({
  labels = defaultLabels,
  paymentSettings,
}: SignupFormProps) {
  const [state, formAction] = useActionState(signUpAction, initialSignupState);
  const fieldErrors = state?.fieldErrors ?? {};
  const hasHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [username, setUsername] = useState(state.formValues?.username ?? "");
  const [email, setEmail] = useState(state.formValues?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(state.formValues?.whatsapp ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [selectedChannelCode, setSelectedChannelCode] = useState(
    paymentSettings.defaultChannelCode ?? paymentSettings.activeChannels[0]?.code ?? "",
  );
  const [selectedPlanId, setSelectedPlanId] = useState(
    paymentSettings.defaultPlanId ?? paymentSettings.plans[0]?.id ?? "",
  );
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlowState>({
    fingerprint: null,
    message: null,
    payment: null,
    referenceId: null,
    status: "idle",
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>({
    status: "idle",
    value: "",
    message: null,
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedWhatsapp = whatsapp.trim();

  const usernameLocalIssue = useMemo(() => {
    if (!normalizedUsername) {
      return null;
    }

    return getUsernameValidationMessage(normalizedUsername);
  }, [normalizedUsername]);

  useEffect(() => {
    if (!normalizedUsername || usernameLocalIssue) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setUsernameAvailability({
        status: "checking",
        value: normalizedUsername,
        message: labels.usernameStatusChecking,
      });

      try {
        const response = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(normalizedUsername)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          available?: boolean;
          message?: string;
        };

        if (!response.ok) {
          setUsernameAvailability({
            status: "error",
            value: normalizedUsername,
            message: payload.message ?? labels.usernameStatusError,
          });

          return;
        }

        setUsernameAvailability({
          status: payload.available ? "available" : "taken",
          value: normalizedUsername,
          message:
            payload.message ??
            (payload.available ? labels.usernameStatusAvailable : labels.usernameStatusTaken),
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setUsernameAvailability({
          status: "error",
          value: normalizedUsername,
          message: labels.usernameStatusError,
        });
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    labels.usernameStatusAvailable,
    labels.usernameStatusChecking,
    labels.usernameStatusError,
    labels.usernameStatusTaken,
    normalizedUsername,
    usernameLocalIssue,
  ]);

  const usernameStatus = useMemo(() => {
    if (!normalizedUsername) {
      return {
        tone: "neutral" as const,
        message: labels.usernameStatusGuidance,
      };
    }

    if (usernameLocalIssue) {
      return {
        tone: "invalid" as const,
        message: usernameLocalIssue,
      };
    }

    if (usernameAvailability.value !== normalizedUsername) {
      return {
        tone: "checking" as const,
        message: labels.usernameStatusChecking,
      };
    }

    if (usernameAvailability.status === "available") {
      return {
        tone: "available" as const,
        message: usernameAvailability.message,
      };
    }

    if (usernameAvailability.status === "taken") {
      return {
        tone: "taken" as const,
        message: usernameAvailability.message,
      };
    }

    if (usernameAvailability.status === "error") {
      return {
        tone: "error" as const,
        message: usernameAvailability.message,
      };
    }

    return {
      tone: "checking" as const,
      message: labels.usernameStatusChecking,
    };
  }, [labels.usernameStatusChecking, labels.usernameStatusGuidance, normalizedUsername, usernameAvailability, usernameLocalIssue]);

  const passwordMetrics = useMemo(() => {
    const length = password.length;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    const matches = length > 0 && password === passwordConfirmation;

    let score = 0;
    if (length >= 8) score += 1;
    if (length >= 12) score += 1;
    if (variety >= 2) score += 1;
    if (variety >= 3) score += 1;
    if (variety >= 4) score += 1;

    const levels = [
      { label: "Belum aman", tone: "bg-slate-300 text-slate-500", accent: "bg-slate-300" },
      { label: "Lemah", tone: "bg-rose-100 text-rose-700", accent: "bg-rose-500" },
      { label: "Cukup", tone: "bg-amber-100 text-amber-700", accent: "bg-amber-500" },
      { label: "Lumayan kuat", tone: "bg-sky-100 text-sky-700", accent: "bg-sky-500" },
      { label: "Kuat", tone: "bg-emerald-100 text-emerald-700", accent: "bg-emerald-500" },
      { label: "Sangat kuat", tone: "bg-emerald-100 text-emerald-700", accent: "bg-emerald-600" },
    ] as const;

    const level = levels[score];

    return {
      length,
      level,
      matches,
      score,
      checks: [
        { label: "Minimal 8 karakter", done: length >= 8 },
        { label: "Ada huruf kecil dan besar", done: hasLower && hasUpper },
        { label: "Ada angka", done: hasNumber },
        { label: "Ada simbol", done: hasSymbol },
        { label: "Password sama", done: matches },
      ],
    };
  }, [password, passwordConfirmation]);

  const isUsernameBlocked =
    usernameStatus.tone === "invalid" ||
    usernameStatus.tone === "taken" ||
    usernameStatus.tone === "checking";
  const selectedPlan =
    paymentSettings.plans.find((plan) => plan.id === selectedPlanId) ??
    paymentSettings.plans.find((plan) => plan.id === paymentSettings.defaultPlanId) ??
    paymentSettings.plans[0];
  const paymentIdentity = useMemo(
    () =>
      JSON.stringify({
        channel: selectedChannelCode,
        email: normalizedEmail,
        planId: selectedPlanId,
        username: normalizedUsername,
        whatsapp: normalizedWhatsapp,
      }),
    [normalizedEmail, normalizedUsername, normalizedWhatsapp, selectedChannelCode, selectedPlanId],
  );
  const isPaymentRequired = paymentSettings.isEnabled;
  const canCreatePayment =
    Boolean(
      normalizedUsername &&
        normalizedEmail &&
        normalizedWhatsapp &&
        selectedChannelCode &&
        selectedPlanId,
    ) &&
    !isUsernameBlocked &&
    paymentFlow.status !== "creating";
  const isSignupLocked = isPaymentRequired && paymentFlow.status !== "paid";
  const currentPaymentChannel =
    paymentSettings.activeChannels.find(
      (channel) => channel.code === (paymentFlow.payment?.channelCode ?? selectedChannelCode),
    ) ?? null;
  const currentInstructionKind = paymentInstructionKind(currentPaymentChannel?.type, paymentFlow.payment);

  useEffect(() => {
    if (!paymentFlow.payment?.qrString) {
      setQrDataUrl(null);
      return;
    }

    QRCodeLib.toDataURL(paymentFlow.payment.qrString, {
      width: 280,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [paymentFlow.payment?.qrString]);

  function clearPaymentFlow(message: string) {
    if (!paymentFlow.referenceId) {
      return;
    }

    setPaymentFlow({
      fingerprint: null,
      message,
      payment: null,
      referenceId: null,
      status: "idle",
    });
  }

  useEffect(() => {
    if (paymentFlow.status !== "pending" || !paymentFlow.referenceId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/signup/payment/status?referenceId=${encodeURIComponent(paymentFlow.referenceId ?? "")}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          message?: string;
          payment?: SignupPaymentPublicState;
        };

        if (!response.ok || !payload.payment) {
          return;
        }

        const payment = payload.payment;

        setPaymentFlow((current) => ({
          fingerprint: current.fingerprint,
          message:
            payment.status === "paid"
              ? "Pembayaran terverifikasi. Sekarang Anda bisa membuat akun."
              : payment.message ?? current.message,
          payment,
          referenceId: payment.referenceId,
          status: payment.status === "paid" ? "paid" : payment.status,
        }));
      } catch {
        // Keep local pending state and let manual check handle messaging.
      }
    }, 6000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [paymentFlow.referenceId, paymentFlow.status]);

  async function handleCreatePayment() {
    setPaymentFlow({
      fingerprint: paymentIdentity,
      message: null,
      payment: null,
      referenceId: null,
      status: "creating",
    });

    try {
      const response = await fetch("/api/signup/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelCode: selectedChannelCode,
          email: normalizedEmail,
          planId: selectedPlan?.id ?? selectedPlanId,
          username: normalizedUsername,
          whatsapp: normalizedWhatsapp,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        payment?: SignupPaymentPublicState;
      };

      if (!response.ok || !payload.payment) {
        setPaymentFlow({
          fingerprint: null,
          message: payload.message ?? "Belum bisa membuat pembayaran sekarang.",
          payment: null,
          referenceId: null,
          status: "error",
        });

        return;
      }

      setPaymentFlow({
        fingerprint: paymentIdentity,
        message:
          payload.payment.status === "paid"
            ? "Pembayaran langsung terverifikasi. Anda bisa lanjut membuat akun."
            : "Pembayaran berhasil dibuat. Selesaikan pembayaran, lalu sistem akan memeriksa statusnya otomatis.",
        payment: payload.payment,
        referenceId: payload.payment.referenceId,
        status: payload.payment.status,
      });
    } catch {
      setPaymentFlow({
        fingerprint: null,
        message: "Belum bisa membuat pembayaran sekarang.",
        payment: null,
        referenceId: null,
        status: "error",
      });
    }
  }

  async function handleCheckPaymentStatus() {
    if (!paymentFlow.referenceId) {
      return;
    }

    setPaymentFlow((current) => ({
      ...current,
      message: "Sedang memeriksa status pembayaran...",
    }));

    try {
      const response = await fetch(
        `/api/signup/payment/status?referenceId=${encodeURIComponent(paymentFlow.referenceId)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        message?: string;
        payment?: SignupPaymentPublicState;
      };

      if (!response.ok || !payload.payment) {
        setPaymentFlow((current) => ({
          ...current,
          message: payload.message ?? "Belum bisa memeriksa status pembayaran.",
          status: current.payment ? current.status : "error",
        }));

        return;
      }

      const payment = payload.payment;

      setPaymentFlow((current) => ({
        fingerprint: current.fingerprint,
        message:
          payment.status === "paid"
            ? "Pembayaran terverifikasi. Sekarang Anda bisa membuat akun."
            : payment.message ?? "Pembayaran masih menunggu penyelesaian.",
        payment,
        referenceId: payment.referenceId,
        status: payment.status,
      }));
    } catch {
      setPaymentFlow((current) => ({
        ...current,
        message: "Belum bisa memeriksa status pembayaran.",
      }));
    }
  }

  async function handleCopyPaymentValue(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800);
    } catch {
      setPaymentFlow((current) => ({
        ...current,
        message: "Belum bisa menyalin data pembayaran dari browser ini.",
      }));
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="paymentReferenceId" type="hidden" value={paymentFlow.referenceId ?? ""} />
      <input name="selectedPlanId" type="hidden" value={selectedPlan?.id ?? ""} />

      {state?.message ? (
        <Alert
          className="flex items-start gap-3"
          variant={state.status === "error" ? "error" : "success"}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </Alert>
      ) : null}

      {paymentFlow.message ? (
        <Alert
          className="flex items-start gap-3"
          variant={paymentFlow.status === "paid" ? "success" : paymentFlow.status === "error" ? "error" : "default"}
        >
          {paymentFlow.status === "paid" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{paymentFlow.message}</p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <AuthFieldShell error={fieldErrors.username}>
            <Label className="mb-2 inline-flex items-center gap-2 text-slate-700" htmlFor="username">
              <AtSign className="h-4 w-4 text-sky-500" />
              {labels.username}
            </Label>
            <Input
              autoCapitalize="none"
              autoComplete="username"
              className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              id="username"
              name="username"
              onChange={(event) => {
                clearPaymentFlow("Data form berubah. Buat ulang pembayaran agar datanya tetap sinkron.");
                setUsername(event.target.value);
              }}
              placeholder={labels.usernamePlaceholder}
              required
              spellCheck={false}
              type="text"
              value={username}
            />
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-2 text-xs",
                usernameStatus.tone === "available" && "text-emerald-700",
                usernameStatus.tone === "checking" && "text-sky-700",
                (usernameStatus.tone === "taken" ||
                  usernameStatus.tone === "invalid" ||
                  usernameStatus.tone === "error") &&
                  "text-rose-600",
                usernameStatus.tone === "neutral" && "text-slate-500",
              )}
            >
              {usernameStatus.tone === "available" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              {usernameStatus.tone === "checking" ? (
                <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : null}
              {(usernameStatus.tone === "taken" ||
                usernameStatus.tone === "invalid" ||
                usernameStatus.tone === "error") ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              {usernameStatus.tone === "neutral" ? (
                <Circle className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              <span>{usernameStatus.message}</span>
            </div>
          </AuthFieldShell>
          {fieldErrors.username && usernameStatus.tone !== "taken" ? (
            <p className="text-sm text-rose-600">{fieldErrors.username}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <AuthFieldShell error={fieldErrors.email}>
            <Label className="mb-2 inline-flex items-center gap-2 text-slate-700" htmlFor="email">
              <Mail className="h-4 w-4 text-sky-500" />
              {labels.email}
            </Label>
            <Input
              autoComplete="email"
              className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              id="email"
              name="email"
              onChange={(event) => {
                clearPaymentFlow("Data form berubah. Buat ulang pembayaran agar datanya tetap sinkron.");
                setEmail(event.target.value);
              }}
              placeholder={labels.emailPlaceholder}
              required
              type="email"
              value={email}
            />
          </AuthFieldShell>
          {fieldErrors.email ? <p className="text-sm text-rose-600">{fieldErrors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <AuthFieldShell error={fieldErrors.whatsapp}>
            <Label className="mb-2 inline-flex items-center gap-2 text-slate-700" htmlFor="whatsapp">
              <MessageCircleMore className="h-4 w-4 text-sky-500" />
              {labels.whatsapp}
            </Label>
            <Input
              autoComplete="tel"
              className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              id="whatsapp"
              name="whatsapp"
              onChange={(event) => {
                clearPaymentFlow("Data form berubah. Buat ulang pembayaran agar datanya tetap sinkron.");
                setWhatsapp(event.target.value);
              }}
              placeholder={labels.whatsappPlaceholder}
              required
              type="tel"
              value={whatsapp}
            />
          </AuthFieldShell>
          {fieldErrors.whatsapp ? <p className="text-sm text-rose-600">{fieldErrors.whatsapp}</p> : null}
        </div>

        <div className="space-y-2">
          <AuthFieldShell error={fieldErrors.password}>
            <Label className="mb-2 inline-flex items-center gap-2 text-slate-700" htmlFor="password">
              <KeyRound className="h-4 w-4 text-sky-500" />
              {labels.password}
            </Label>
            <Input
              autoComplete="new-password"
              className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              id="password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={labels.passwordPlaceholder}
              required
              type="password"
              value={password}
            />
          </AuthFieldShell>
          {fieldErrors.password ? <p className="text-sm text-rose-600">{fieldErrors.password}</p> : null}
        </div>

        <div className="space-y-2">
          <AuthFieldShell error={fieldErrors.passwordConfirmation}>
            <Label
              className="mb-2 inline-flex items-center gap-2 text-slate-700"
              htmlFor="passwordConfirmation"
            >
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              {labels.passwordConfirmation}
            </Label>
            <Input
              autoComplete="new-password"
              className="border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
              id="passwordConfirmation"
              name="passwordConfirmation"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder={labels.passwordConfirmationPlaceholder}
              required
              type="password"
              value={passwordConfirmation}
            />
          </AuthFieldShell>
          {fieldErrors.passwordConfirmation ? (
            <p className="text-sm text-rose-600">{fieldErrors.passwordConfirmation}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">{labels.passwordCheckTitle}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{passwordMetrics.length} {labels.passwordLengthLabel}</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", passwordMetrics.level.tone)}>
              {passwordMetrics.level.label}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index < passwordMetrics.score ? passwordMetrics.level.accent : "bg-slate-200",
              )}
              key={index}
            />
          ))}
        </div>
        <div className="mt-3 text-sm text-slate-500">
          {passwordMetrics.length === 0
            ? labels.passwordCheckDescriptionEmpty
            : passwordMetrics.matches
              ? labels.passwordCheckDescriptionMatch
              : labels.passwordCheckDescriptionStrong}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {passwordMetrics.checks.map((item) => (
            <ChecklistItem done={item.done} key={item.label} label={item.label} />
          ))}
        </div>
      </div>

      {paymentSettings.isEnabled ? (
        <div className="rounded-xl border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.96)_0%,rgba(248,250,252,0.98)_100%)] p-5 shadow-[0_18px_40px_rgba(14,165,233,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                <CreditCard className="h-3.5 w-3.5" />
                {labels.payment}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                {selectedPlan?.label ?? paymentSettings.priceLabel}
              </h3>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {formatIdrCurrency(selectedPlan?.price ?? paymentSettings.registrationPrice)}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{paymentSettings.checkoutNote}</p>
              
            </div>
            <span className="rounded-2xl bg-sky-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              {paymentSettings.provider}
            </span>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.subscriptionDuration}</p>
            <div className="mt-3 grid gap-3">
              {paymentSettings.plans.map((plan) => {
                const selected = selectedPlan?.id === plan.id;

                return (
                  <button
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors",
                      selected
                        ? "border-sky-300 bg-sky-100 text-sky-950 shadow-[0_14px_28px_rgba(14,165,233,0.14)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70",
                    )}
                    key={plan.id}
                    onClick={() => {
                      if (plan.id !== selectedPlanId) {
                        clearPaymentFlow("Paket langganan diganti. Buat ulang pembayaran agar nominalnya sesuai.");
                        setSelectedPlanId(plan.id);
                      }
                    }}
                    type="button"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        
                        
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        {plan.isLifetime ? "Lifetime" : `${plan.durationMonths} bulan`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-slate-950">{formatIdrCurrency(plan.price)}</p>
                      {selected ? <CheckCircle2 className="ml-auto mt-3 h-4 w-4 text-sky-700" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.paymentMethod}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {paymentSettings.activeChannels.map((channel) => {
                const Icon = paymentChannelIcon(channel.type);
                const selected = selectedChannelCode === channel.code;

                return (
                  <button
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                      selected
                        ? "border-sky-300 bg-sky-100 text-sky-950 shadow-[0_14px_28px_rgba(14,165,233,0.14)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70",
                    )}
                    key={channel.code}
                    onClick={() => {
                      if (channel.code !== selectedChannelCode) {
                        clearPaymentFlow("Metode pembayaran diganti. Buat ulang pembayaran agar datanya tetap sinkron.");
                        setSelectedChannelCode(channel.code);
                      }
                    }}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-white/80 p-2 text-sky-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="space-y-1">
                        <span className="block">{channel.name}</span>
                        <span className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          {channel.type === "va"
                            ? "Virtual Account"
                            : channel.type === "qris"
                              ? "QRIS"
                              : "E-Wallet"}
                        </span>
                      </span>
                    </span>
                    
                  </button>
                );
              })}
            </div>

          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white/60 p-1">
              <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.paymentStepTitle}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {labels.paymentStepDescription}
                </p>
              </div>
              <Button
                className="h-11 w-full rounded-xl bg-sky-500 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(14,165,233,0.22)] hover:bg-sky-600 sm:w-auto"
                disabled={!hasHydrated || !canCreatePayment}
                onClick={handleCreatePayment}
                type="button"
              >
                {paymentFlow.status === "creating" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {paymentFlow.referenceId ? labels.createPaymentAgain : labels.createPayment}
              </Button>
            </div>
            </div>

            {paymentFlow.payment ? (
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_44px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status pembayaran</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {paymentFlow.status === "paid"
                        ? "Sudah berhasil"
                        : paymentFlow.status === "failed"
                          ? "Perlu dibuat ulang"
                          : "Menunggu pembayaran"}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>Reference: {paymentFlow.payment.referenceId}</p>
                      <p>Paket: {paymentFlow.payment.planLabel ?? selectedPlan?.label ?? "-"}</p>
                      <p>Channel: {paymentFlow.payment.paymentName ?? paymentFlow.payment.channelCode}</p>
                      {paymentFlow.payment.paymentNumber ? <p>No. bayar: {paymentFlow.payment.paymentNumber}</p> : null}
                      {paymentFlow.payment.expiresAt ? <p>Berlaku sampai: {paymentFlow.payment.expiresAt}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="w-full rounded-xl sm:w-auto" onClick={handleCheckPaymentStatus} type="button" variant="outline">
                      <RefreshCw className="h-4 w-4" />
                      Cek status
                    </Button>
                    
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Instruksi pembayaran
                  </p>

                  {currentInstructionKind === "qris" ? (
                    <div className="mt-4 space-y-4">
                      <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {paymentFlow.payment.qrImageUrl || qrDataUrl ? (
                          <img
                            alt="QRIS pembayaran signup"
                            className="aspect-square w-full rounded-xl bg-white object-contain"
                            src={paymentFlow.payment.qrImageUrl ?? qrDataUrl ?? ""}
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-500">
                            QR sedang disiapkan.
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Bayar langsung</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Scan QRIS menggunakan mobile banking atau e-wallet yang mendukung QRIS. Setelah pembayaran sukses, status akan diperiksa otomatis.
                          </p>
                        </div>
                      </div>




                    </div>
                  ) : null}

                  {currentInstructionKind === "bank" ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(241,245,249,0.95)_100%)] p-4">
                        <p className="text-sm font-medium text-slate-700">Nomor pembayaran</p>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-all text-xl font-semibold tracking-[0.06em] text-slate-950">
                              {paymentFlow.payment.paymentNumber ?? "-"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Transfer tepat sesuai nominal ke{" "}
                              {paymentFlow.payment.paymentName ?? currentPaymentChannel?.name ?? "virtual account"}.
                            </p>
                          </div>
                          {paymentFlow.payment.paymentNumber ? (
                            <Button
                              className="w-full rounded-xl sm:w-auto"
                              onClick={() =>
                                handleCopyPaymentValue(
                                  paymentFlow.payment?.paymentNumber ?? "",
                                  "payment-number",
                                )
                              }
                              type="button"
                              variant="outline"
                            >
                              <Copy className="h-4 w-4" />
                              {copiedField === "payment-number" ? "Tersalin" : "Salin nomor"}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Nominal
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {formatIdrCurrency(paymentFlow.payment.amount)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Metode
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {paymentFlow.payment.paymentName ?? currentPaymentChannel?.name ?? "Virtual Account"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {currentInstructionKind === "link" ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm leading-6 text-slate-600">
                        Metode ini perlu dibuka melalui halaman payment provider. Gunakan tombol di bawah untuk menyelesaikan pembayaran.
                      </p>
                      {paymentFlow.payment.paymentUrl ? (
                        <a
                          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
                          href={paymentFlow.payment.paymentUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Buka pembayaran
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <SubmitButton
        className="h-12 w-full rounded-lg bg-sky-500 text-base font-semibold text-white shadow-[0_16px_30px_rgba(14,165,233,0.22)] hover:bg-sky-600"
        disabled={isUsernameBlocked || isSignupLocked}
        pendingText={labels.createPaymentPending}
      >
        {isSignupLocked ? labels.signupLocked : labels.createAccount}
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        {labels.accountReady}{" "}
        <Link
          className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-4"
          href="/login"
        >
          {labels.backToLogin}
        </Link>
      </p>
    </form>
  );
}
