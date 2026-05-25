import "server-only";

import type { NormalizedSignupPaymentStatus } from "@/lib/signup-payment-types";

const PAKASIR_BASE_URL = "https://app.pakasir.com/api";

export type PakasirPaymentSnapshot = {
  expiresAt: string | null;
  message: string | null;
  paymentName: string | null;
  paymentNumber: string | null;
  providerTransactionId: string | null;
  qrString: string | null;
  raw: unknown;
  status: NormalizedSignupPaymentStatus;
};

type PakasirCreateTransactionInput = {
  amount: number;
  method: string;
  orderId: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!isPlainObject(current) || !(key in current)) {
      return null;
    }

    current = current[key];
  }

  return current;
}

function pickString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath(value, path);

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizePaymentStatus(value: unknown): NormalizedSignupPaymentStatus {
  const rawStatus = String(value ?? "").trim().toLowerCase();

  if (
    rawStatus.includes("completed") ||
    rawStatus.includes("paid") ||
    rawStatus.includes("success") ||
    rawStatus.includes("settlement") ||
    rawStatus.includes("berhasil") ||
    rawStatus.includes("sukses")
  ) {
    return "paid";
  }

  if (
    rawStatus.includes("fail") ||
    rawStatus.includes("expired") ||
    rawStatus.includes("cancel") ||
    rawStatus.includes("deny") ||
    rawStatus.includes("error")
  ) {
    return "failed";
  }

  return "pending";
}

function parsePakasirSnapshot(raw: unknown): PakasirPaymentSnapshot {
  const providerTransactionId = pickString(raw, [
    ["payment", "order_id"],
    ["transaction", "order_id"],
    ["order_id"],
  ]);

  const paymentNumber = pickString(raw, [
    ["payment", "payment_number"],
    ["payment_number"],
  ]);

  const paymentName = pickString(raw, [
    ["payment", "payment_method"],
    ["payment_method"],
  ]);

  const qrString = pickString(raw, [
    ["payment", "payment_number"],
    ["payment_number"],
  ]);

  const expiresAt = pickString(raw, [
    ["payment", "expired_at"],
    ["expired_at"],
  ]);

  const message = pickString(raw, [
    ["message"],
    ["error"],
  ]);

  const rawStatus = pickString(raw, [
    ["payment", "status"],
    ["transaction", "status"],
    ["status"],
  ]);

  return {
    expiresAt,
    message,
    paymentName,
    paymentNumber,
    providerTransactionId,
    qrString,
    raw,
    status: normalizePaymentStatus(rawStatus),
  };
}

export async function createPakasirTransaction(
  slug: string,
  apiKey: string,
  input: PakasirCreateTransactionInput,
) {
  const response = await fetch(`${PAKASIR_BASE_URL}/transactioncreate/${input.method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project: slug,
      order_id: input.orderId,
      amount: input.amount,
      api_key: apiKey,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = pickString(payload, [["message"], ["error"]]) ?? "Pakasir request failed.";
    throw new Error(message);
  }

  return parsePakasirSnapshot(payload);
}

export async function checkPakasirTransactionStatus(
  slug: string,
  apiKey: string,
  input: { amount: number; orderId: string },
) {
  const params = new URLSearchParams({
    project: slug,
    amount: String(input.amount),
    order_id: input.orderId,
    api_key: apiKey,
  });

  const response = await fetch(`${PAKASIR_BASE_URL}/transactiondetail?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = pickString(payload, [["message"], ["error"]]) ?? "Pakasir status check failed.";
    throw new Error(message);
  }

  return parsePakasirSnapshot(payload);
}
