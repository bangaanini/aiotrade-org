import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  checkPaymenkuTransactionStatus,
  createPaymenkuTransaction,
} from "@/lib/paymenku";
import {
  checkPakasirTransactionStatus,
  createPakasirTransaction,
} from "@/lib/pakasir";
import { getPaymentGatewaySettings } from "@/lib/payment-gateway-settings";
import { getSiteSeoSettings } from "@/lib/site-seo";
import type {
  NormalizedSignupPaymentStatus,
  SignupPaymentPublicState,
} from "@/lib/signup-payment-types";

const SIGNUP_PAYMENT_REFERENCE_PREFIX = "AIOREG";

type SignupPaymentRecord = {
  amount: number;
  channelCode: string;
  consumedAt?: Date | null;
  customerEmail: string;
  customerName: string;
  expiresAt?: string | null;
  message?: string | null;
  planId?: string | null;
  planLabel?: string | null;
  paymentName?: string | null;
  paymentNumber?: string | null;
  paymentUrl?: string | null;
  providerTransactionId?: string | null;
  qrImageUrl?: string | null;
  qrString?: string | null;
  referenceId: string;
  status: string;
};

function hasSignupPaymentTransactionDelegate() {
  return (
    "signupPaymentTransaction" in prisma &&
    typeof prisma.signupPaymentTransaction?.create === "function" &&
    typeof prisma.signupPaymentTransaction?.update === "function" &&
    typeof prisma.signupPaymentTransaction?.findUnique === "function"
  );
}

async function signupPaymentTransactionsTableExists() {
  try {
    const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
      SELECT to_regclass('public.signup_payment_transactions')::text AS "tableName"
    `;

    return Boolean(tables[0]?.tableName);
  } catch {
    return false;
  }
}

function normalizeReferenceFragment(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function generateSignupPaymentReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = normalizeReferenceFragment(crypto.randomUUID()).slice(0, 10);

  return `${SIGNUP_PAYMENT_REFERENCE_PREFIX}-${timestamp}-${randomPart}`;
}

function toJsonValue(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function toPublicState(
  payment: SignupPaymentRecord | null | undefined,
): SignupPaymentPublicState | null {
  if (!payment) {
    return null;
  }

  return {
    amount: payment.amount,
    channelCode: payment.channelCode,
    customerEmail: payment.customerEmail,
    customerName: payment.customerName,
    expiresAt: payment.expiresAt ?? null,
    message: payment.message ?? null,
    planId: payment.planId ?? null,
    planLabel: payment.planLabel ?? null,
    paymentName: payment.paymentName ?? null,
    paymentNumber: payment.paymentNumber ?? null,
    paymentUrl: payment.paymentUrl ?? null,
    providerTransactionId: payment.providerTransactionId ?? null,
    qrImageUrl: payment.qrImageUrl ?? null,
    qrString: payment.qrString ?? null,
    referenceId: payment.referenceId,
    status:
      payment.status === "paid" || payment.status === "failed" ? payment.status : "pending",
  };
}

async function createLocalPaymentRecord(input: {
  amount: number;
  channelCode: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  planId: string;
  planLabel: string;
  referenceId: string;
}) {
  if (hasSignupPaymentTransactionDelegate()) {
    return prisma.signupPaymentTransaction.create({
      data: {
        amount: input.amount,
        channelCode: input.channelCode,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        planId: input.planId,
        planLabel: input.planLabel,
        referenceId: input.referenceId,
        status: "pending",
      },
      select: {
        amount: true,
        channelCode: true,
        customerEmail: true,
        customerName: true,
        planId: true,
        planLabel: true,
        referenceId: true,
        status: true,
      },
    });
  }

  if (!(await signupPaymentTransactionsTableExists())) {
    throw new Error("Tabel signup payment belum tersedia. Jalankan migrasi database terbaru.");
  }

  const inserted = await prisma.$queryRaw<SignupPaymentRecord[]>`
    INSERT INTO "public"."signup_payment_transactions" (
      "reference_id",
      "channel_code",
      "amount",
      "customer_name",
      "customer_email",
      "customer_phone",
      "plan_id",
      "plan_label",
      "status"
    )
    VALUES (
      ${input.referenceId},
      ${input.channelCode},
      ${input.amount},
      ${input.customerName},
      ${input.customerEmail},
      ${input.customerPhone ?? null},
      ${input.planId},
      ${input.planLabel},
      'pending'
    )
    RETURNING
      "amount",
      "channel_code" AS "channelCode",
      "customer_email" AS "customerEmail",
      "customer_name" AS "customerName",
      "plan_id" AS "planId",
      "plan_label" AS "planLabel",
      "reference_id" AS "referenceId",
      "status"
  `;

  return inserted[0] ?? null;
}

async function updateLocalPaymentRecord(
  referenceId: string,
  input: {
    expiresAt?: string | null;
    message?: string | null;
    paymentName?: string | null;
    paymentNumber?: string | null;
    paymentUrl?: string | null;
    planId?: string | null;
    planLabel?: string | null;
    providerTransactionId?: string | null;
    qrImageUrl?: string | null;
    qrString?: string | null;
    rawCreateResponse?: unknown;
    rawStatusResponse?: unknown;
    status?: NormalizedSignupPaymentStatus;
  },
) {
  if (hasSignupPaymentTransactionDelegate()) {
    return prisma.signupPaymentTransaction.update({
      where: {
        referenceId,
      },
      data: {
        expiresAt: input.expiresAt,
        message: input.message,
        paidAt: input.status === "paid" ? new Date() : undefined,
        paymentName: input.paymentName,
        paymentNumber: input.paymentNumber,
        paymentUrl: input.paymentUrl,
        planId: input.planId,
        planLabel: input.planLabel,
        providerTransactionId: input.providerTransactionId,
        qrImageUrl: input.qrImageUrl,
        qrString: input.qrString,
        rawCreateResponse: toJsonValue(input.rawCreateResponse),
        rawStatusResponse: toJsonValue(input.rawStatusResponse),
        status: input.status,
      },
      select: {
        amount: true,
        channelCode: true,
        customerEmail: true,
        customerName: true,
        expiresAt: true,
        message: true,
        planId: true,
        planLabel: true,
        paymentName: true,
        paymentNumber: true,
        paymentUrl: true,
        providerTransactionId: true,
        qrImageUrl: true,
        qrString: true,
        referenceId: true,
        status: true,
      },
    });
  }

  const updated = await prisma.$queryRaw<SignupPaymentRecord[]>`
    UPDATE "public"."signup_payment_transactions"
    SET
      "expires_at" = ${input.expiresAt ?? null},
      "message" = ${input.message ?? null},
      "paid_at" = CASE WHEN ${input.status === "paid"} THEN CURRENT_TIMESTAMP ELSE "paid_at" END,
      "payment_name" = ${input.paymentName ?? null},
      "payment_number" = ${input.paymentNumber ?? null},
      "payment_url" = ${input.paymentUrl ?? null},
      "plan_id" = COALESCE(${input.planId ?? null}, "plan_id"),
      "plan_label" = COALESCE(${input.planLabel ?? null}, "plan_label"),
      "provider_transaction_id" = ${input.providerTransactionId ?? null},
      "qr_image_url" = ${input.qrImageUrl ?? null},
      "qr_string" = ${input.qrString ?? null},
      "raw_create_response" = COALESCE(${JSON.stringify(input.rawCreateResponse ?? null)}::jsonb, "raw_create_response"),
      "raw_status_response" = COALESCE(${JSON.stringify(input.rawStatusResponse ?? null)}::jsonb, "raw_status_response"),
      "status" = COALESCE(${input.status ?? null}, "status"),
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "reference_id" = ${referenceId}
    RETURNING
      "amount",
      "channel_code" AS "channelCode",
      "customer_email" AS "customerEmail",
      "customer_name" AS "customerName",
      "expires_at" AS "expiresAt",
      "message",
      "plan_id" AS "planId",
      "plan_label" AS "planLabel",
      "payment_name" AS "paymentName",
      "payment_number" AS "paymentNumber",
      "payment_url" AS "paymentUrl",
      "provider_transaction_id" AS "providerTransactionId",
      "qr_image_url" AS "qrImageUrl",
      "qr_string" AS "qrString",
      "reference_id" AS "referenceId",
      "status"
  `;

  return updated[0] ?? null;
}

export async function createSignupPayment(input: {
  channelCode: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  planId: string;
}) {
  const settings = await getPaymentGatewaySettings();
  const siteSeo = await getSiteSeoSettings();

  if (!settings.isEnabled) {
    throw new Error("Pembayaran pendaftaran belum diaktifkan.");
  }

  if (!settings.activeChannelCodes.includes(input.channelCode)) {
    throw new Error("Metode pembayaran tidak tersedia.");
  }

  const selectedPlan =
    settings.subscriptionPlans.find((plan) => plan.id === input.planId) ??
    settings.subscriptionPlans.find((plan) => plan.id === settings.defaultPlanId) ??
    settings.subscriptionPlans[0];

  if (!selectedPlan) {
    throw new Error("Paket langganan belum tersedia.");
  }

  const referenceId = generateSignupPaymentReferenceId();

  await createLocalPaymentRecord({
    amount: selectedPlan.price,
    channelCode: input.channelCode,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    planId: selectedPlan.id,
    planLabel: selectedPlan.label,
    referenceId,
  });

  try {
    if (settings.provider === "pakasir") {
      if (!settings.pakasirSlug || !settings.pakasirApiKey) {
        throw new Error("Pakasir belum dikonfigurasi.");
      }

      const transaction = await createPakasirTransaction(
        settings.pakasirSlug,
        settings.pakasirApiKey,
        {
          amount: selectedPlan.price,
          orderId: referenceId,
          method: input.channelCode,
        }
      );

      const updated = await updateLocalPaymentRecord(referenceId, {
        expiresAt: transaction.expiresAt,
        message: transaction.message,
        planId: selectedPlan.id,
        planLabel: selectedPlan.label,
        paymentName: transaction.paymentName,
        paymentNumber: transaction.paymentNumber,
        providerTransactionId: transaction.providerTransactionId,
        qrString: transaction.qrString,
        rawCreateResponse: transaction.raw,
        status: transaction.status,
      });

      return toPublicState(updated);
    } else {
      if (!settings.paymenkuApiKey) {
        throw new Error("API key Paymenku belum diatur.");
      }

      const transaction = await createPaymenkuTransaction(settings.paymenkuApiKey, {
        amount: selectedPlan.price,
        channelCode: input.channelCode,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        referenceId,
        returnUrl: `${siteSeo.siteUrl.replace(/\/$/, "")}/signup`,
      });

      const updated = await updateLocalPaymentRecord(referenceId, {
        expiresAt: transaction.expiresAt,
        message: transaction.message,
        planId: selectedPlan.id,
        planLabel: selectedPlan.label,
        paymentName: transaction.paymentName,
        paymentNumber: transaction.paymentNumber,
        paymentUrl: transaction.paymentUrl,
        providerTransactionId: transaction.providerTransactionId,
        qrImageUrl: transaction.qrImageUrl,
        qrString: transaction.qrString,
        rawCreateResponse: transaction.raw,
        status: transaction.status,
      });

      return toPublicState(updated);
    }
  } catch (error) {
    await updateLocalPaymentRecord(referenceId, {
      message: error instanceof Error ? error.message : "Gagal membuat pembayaran.",
      status: "failed",
    });

    throw error;
  }
}

export async function getSignupPayment(referenceId: string) {
  if (hasSignupPaymentTransactionDelegate()) {
    return prisma.signupPaymentTransaction.findUnique({
      where: {
        referenceId,
      },
      select: {
        amount: true,
        channelCode: true,
        consumedAt: true,
        customerEmail: true,
        customerName: true,
        expiresAt: true,
        message: true,
        planId: true,
        planLabel: true,
        paymentName: true,
        paymentNumber: true,
        paymentUrl: true,
        providerTransactionId: true,
        qrImageUrl: true,
        qrString: true,
        referenceId: true,
        status: true,
      },
    });
  }

  const payments = await prisma.$queryRaw<SignupPaymentRecord[]>`
    SELECT
      "amount",
      "channel_code" AS "channelCode",
      "consumed_at" AS "consumedAt",
      "customer_email" AS "customerEmail",
      "customer_name" AS "customerName",
      "expires_at" AS "expiresAt",
      "message",
      "plan_id" AS "planId",
      "plan_label" AS "planLabel",
      "payment_name" AS "paymentName",
      "payment_number" AS "paymentNumber",
      "payment_url" AS "paymentUrl",
      "provider_transaction_id" AS "providerTransactionId",
      "qr_image_url" AS "qrImageUrl",
      "qr_string" AS "qrString",
      "reference_id" AS "referenceId",
      "status"
    FROM "public"."signup_payment_transactions"
    WHERE "reference_id" = ${referenceId}
    LIMIT 1
  `;

  return payments[0] ?? null;
}

export async function refreshSignupPaymentStatus(referenceId: string) {
  const settings = await getPaymentGatewaySettings();
  const payment = await getSignupPayment(referenceId);

  if (!payment) {
    return null;
  }

  if (payment.status === "paid" || payment.consumedAt) {
    return toPublicState(payment);
  }

  if (settings.provider === "pakasir") {
    if (!settings.pakasirSlug || !settings.pakasirApiKey) {
      throw new Error("Pakasir belum dikonfigurasi.");
    }

    const statusSnapshot = await checkPakasirTransactionStatus(
      settings.pakasirSlug,
      settings.pakasirApiKey,
      {
        amount: payment.amount,
        orderId: payment.referenceId,
      }
    );

    const updated = await updateLocalPaymentRecord(referenceId, {
      expiresAt: statusSnapshot.expiresAt ?? payment.expiresAt,
      message: statusSnapshot.message ?? payment.message,
      paymentName: statusSnapshot.paymentName ?? payment.paymentName,
      paymentNumber: statusSnapshot.paymentNumber ?? payment.paymentNumber,
      providerTransactionId: statusSnapshot.providerTransactionId ?? payment.providerTransactionId,
      qrString: statusSnapshot.qrString ?? payment.qrString,
      rawStatusResponse: statusSnapshot.raw,
      status: statusSnapshot.status,
    });

    return toPublicState(updated);
  } else {
    if (!settings.paymenkuApiKey) {
      throw new Error("API key Paymenku belum diatur.");
    }

    const statusSnapshot = await checkPaymenkuTransactionStatus(
      settings.paymenkuApiKey,
      payment.providerTransactionId ?? payment.referenceId,
    );

    const updated = await updateLocalPaymentRecord(referenceId, {
      expiresAt: statusSnapshot.expiresAt ?? payment.expiresAt,
      message: statusSnapshot.message ?? payment.message,
      paymentName: statusSnapshot.paymentName ?? payment.paymentName,
      paymentNumber: statusSnapshot.paymentNumber ?? payment.paymentNumber,
      paymentUrl: statusSnapshot.paymentUrl ?? payment.paymentUrl,
      providerTransactionId: statusSnapshot.providerTransactionId ?? payment.providerTransactionId,
      qrImageUrl: statusSnapshot.qrImageUrl ?? payment.qrImageUrl,
      qrString: statusSnapshot.qrString ?? payment.qrString,
      rawStatusResponse: statusSnapshot.raw,
      status: statusSnapshot.status,
    });

    return toPublicState(updated);
  }
}

export async function verifyPaidSignupPayment(referenceId: string | null | undefined) {
  const normalizedReferenceId = String(referenceId ?? "").trim();

  if (!normalizedReferenceId) {
    return null;
  }

  const refreshed = await refreshSignupPaymentStatus(normalizedReferenceId);
  const payment = await getSignupPayment(normalizedReferenceId);

  if (!refreshed || refreshed.status !== "paid" || !payment || payment.consumedAt) {
    return null;
  }

  return refreshed;
}

export async function markSignupPaymentConsumed(referenceId: string) {
  if (hasSignupPaymentTransactionDelegate()) {
    await prisma.signupPaymentTransaction.update({
      where: {
        referenceId,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    return;
  }

  await prisma.$executeRaw`
    UPDATE "public"."signup_payment_transactions"
    SET
      "consumed_at" = CURRENT_TIMESTAMP,
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "reference_id" = ${referenceId}
  `;
}
