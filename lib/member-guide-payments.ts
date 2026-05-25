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
import type { MemberGuidePaymentPublicState } from "@/lib/member-guide-payment-types";
import { getMemberGuidePostById } from "@/lib/member-guides";
import { getSiteSeoSettings } from "@/lib/site-seo";

const MEMBER_GUIDE_PAYMENT_REFERENCE_PREFIX = "AIOGUIDE";

type CurrentMemberProfile = {
  email: string | null;
  id: string;
  username: string;
  whatsapp: string | null;
};

type MemberGuidePaymentRecord = {
  amount: number;
  channelCode: string;
  consumedAt: Date | null;
  customerEmail: string;
  customerName: string;
  expiresAt: string | null;
  guidePostId: string;
  guideTitle: string;
  message: string | null;
  paymentName: string | null;
  paymentNumber: string | null;
  paymentUrl: string | null;
  profileId: string;
  providerTransactionId: string | null;
  qrImageUrl: string | null;
  qrString: string | null;
  referenceId: string;
  status: string;
};

function normalizeReferenceFragment(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function toJsonValue(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function toPublicState(
  payment: MemberGuidePaymentRecord | null | undefined,
  unlocked: boolean,
): MemberGuidePaymentPublicState | null {
  if (!payment) {
    return null;
  }

  return {
    amount: payment.amount,
    channelCode: payment.channelCode,
    customerEmail: payment.customerEmail,
    customerName: payment.customerName,
    expiresAt: payment.expiresAt,
    guideId: payment.guidePostId,
    guideTitle: payment.guideTitle,
    message: payment.message,
    paymentName: payment.paymentName,
    paymentNumber: payment.paymentNumber,
    paymentUrl: payment.paymentUrl,
    providerTransactionId: payment.providerTransactionId,
    qrImageUrl: payment.qrImageUrl,
    qrString: payment.qrString,
    referenceId: payment.referenceId,
    status:
      payment.status === "paid" || payment.status === "failed"
        ? payment.status
        : "pending",
    unlocked,
  };
}

export function generateMemberGuidePaymentReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = normalizeReferenceFragment(crypto.randomUUID()).slice(0, 10);

  return `${MEMBER_GUIDE_PAYMENT_REFERENCE_PREFIX}-${timestamp}-${randomPart}`;
}

async function getMemberGuideUnlock(profileId: string, guidePostId: string) {
  return prisma.memberGuideUnlock.findUnique({
    where: {
      profileId_guidePostId: {
        guidePostId,
        profileId,
      },
    },
    select: {
      id: true,
    },
  });
}

export async function isMemberGuideUnlocked(profileId: string, guidePostId: string) {
  const unlock = await getMemberGuideUnlock(profileId, guidePostId);
  return Boolean(unlock);
}

async function getMemberGuidePayment(referenceId: string) {
  return prisma.memberGuidePaymentTransaction.findUnique({
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
      guidePostId: true,
      guideTitle: true,
      message: true,
      paymentName: true,
      paymentNumber: true,
      paymentUrl: true,
      profileId: true,
      providerTransactionId: true,
      qrImageUrl: true,
      qrString: true,
      referenceId: true,
      status: true,
    },
  });
}

async function updateMemberGuidePayment(
  referenceId: string,
  input: {
    expiresAt?: string | null;
    message?: string | null;
    paymentName?: string | null;
    paymentNumber?: string | null;
    paymentUrl?: string | null;
    providerTransactionId?: string | null;
    qrImageUrl?: string | null;
    qrString?: string | null;
    rawCreateResponse?: unknown;
    rawStatusResponse?: unknown;
    status?: "pending" | "paid" | "failed";
  },
) {
  return prisma.memberGuidePaymentTransaction.update({
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
      consumedAt: true,
      customerEmail: true,
      customerName: true,
      expiresAt: true,
      guidePostId: true,
      guideTitle: true,
      message: true,
      paymentName: true,
      paymentNumber: true,
      paymentUrl: true,
      profileId: true,
      providerTransactionId: true,
      qrImageUrl: true,
      qrString: true,
      referenceId: true,
      status: true,
    },
  });
}

async function consumeAndUnlockGuide(
  payment: MemberGuidePaymentRecord,
) {
  await prisma.$transaction(async (tx) => {
    await tx.memberGuideUnlock.upsert({
      where: {
        profileId_guidePostId: {
          guidePostId: payment.guidePostId,
          profileId: payment.profileId,
        },
      },
      create: {
        amount: payment.amount,
        guidePostId: payment.guidePostId,
        paymentReferenceId: payment.referenceId,
        profileId: payment.profileId,
      },
      update: {
        amount: payment.amount,
        paymentReferenceId: payment.referenceId,
        unlockedAt: new Date(),
      },
    });

    await tx.memberGuidePaymentTransaction.update({
      where: {
        referenceId: payment.referenceId,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  });
}

export async function createMemberGuidePayment(input: {
  channelCode: string;
  guideId: string;
  profile: CurrentMemberProfile;
}) {
  const settings = await getPaymentGatewaySettings();

  if (!settings.isEnabled) {
    throw new Error("Pembayaran sedang dimatikan dari pengaturan admin.");
  }

  if (!settings.activeChannelCodes.includes(input.channelCode)) {
    throw new Error("Metode pembayaran tidak aktif.");
  }

  const guide = await getMemberGuidePostById(input.guideId);

  if (!guide || !guide.isPublished) {
    throw new Error("Materi tidak ditemukan atau belum dipublish.");
  }

  if (!guide.isPaid || !guide.price) {
    throw new Error("Materi ini tidak memerlukan pembayaran.");
  }

  const unlocked = await isMemberGuideUnlocked(input.profile.id, guide.id);

  if (unlocked) {
    throw new Error("Materi ini sudah terbuka di akun Anda.");
  }

  const referenceId = generateMemberGuidePaymentReferenceId();
  const customerEmail = input.profile.email?.trim() || `${input.profile.username}@aiotrade.member`;
  const siteSeo = await getSiteSeoSettings();

  await prisma.memberGuidePaymentTransaction.create({
    data: {
      amount: guide.price,
      channelCode: input.channelCode,
      customerEmail,
      customerName: input.profile.username,
      customerPhone: input.profile.whatsapp ?? null,
      guidePostId: guide.id,
      guideTitle: guide.title,
      profileId: input.profile.id,
      referenceId,
      status: "pending",
    },
  });

  if (settings.provider === "pakasir") {
    if (!settings.pakasirSlug || !settings.pakasirApiKey) {
      throw new Error("Pakasir belum dikonfigurasi.");
    }

    const transaction = await createPakasirTransaction(
      settings.pakasirSlug,
      settings.pakasirApiKey,
      {
        amount: guide.price,
        orderId: referenceId,
        method: input.channelCode,
      }
    );

    const updated = await updateMemberGuidePayment(referenceId, {
      expiresAt: transaction.expiresAt ?? null,
      message: transaction.message ?? null,
      paymentName: transaction.paymentName ?? null,
      paymentNumber: transaction.paymentNumber ?? null,
      providerTransactionId: transaction.providerTransactionId ?? null,
      qrString: transaction.qrString ?? null,
      rawCreateResponse: transaction.raw ?? null,
      status: transaction.status === "paid" || transaction.status === "failed" ? transaction.status : "pending",
    });

    if (updated.status === "paid") {
      await consumeAndUnlockGuide(updated);
      return toPublicState({ ...updated, consumedAt: new Date() }, true);
    }

    return toPublicState(updated, false);
  } else {
    if (!settings.paymenkuApiKey) {
      throw new Error("API key Paymenku belum diatur.");
    }

    const transaction = await createPaymenkuTransaction(settings.paymenkuApiKey, {
      amount: guide.price,
      channelCode: input.channelCode,
      customerEmail,
      customerName: input.profile.username,
      customerPhone: input.profile.whatsapp ?? undefined,
      referenceId,
      returnUrl: siteSeo.siteUrl,
    });

    const updated = await updateMemberGuidePayment(referenceId, {
      expiresAt: transaction.expiresAt ?? null,
      message: transaction.message ?? null,
      paymentName: transaction.paymentName ?? null,
      paymentNumber: transaction.paymentNumber ?? null,
      paymentUrl: transaction.paymentUrl ?? null,
      providerTransactionId: transaction.providerTransactionId ?? null,
      qrImageUrl: transaction.qrImageUrl ?? null,
      qrString: transaction.qrString ?? null,
      rawCreateResponse: transaction.raw ?? null,
      status: transaction.status === "paid" || transaction.status === "failed" ? transaction.status : "pending",
    });

    if (updated.status === "paid") {
      await consumeAndUnlockGuide(updated);
      return toPublicState({ ...updated, consumedAt: new Date() }, true);
    }

    return toPublicState(updated, false);
  }
}

export async function refreshMemberGuidePaymentStatus(input: {
  profileId: string;
  referenceId: string;
}) {
  const settings = await getPaymentGatewaySettings();
  const payment = await getMemberGuidePayment(input.referenceId);

  if (!payment || payment.profileId !== input.profileId) {
    return null;
  }

  const unlocked = await isMemberGuideUnlocked(input.profileId, payment.guidePostId);

  if (unlocked || payment.consumedAt || payment.status === "paid") {
    if (!unlocked && payment.status === "paid") {
      await consumeAndUnlockGuide(payment);
    }

    return toPublicState(payment, true);
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

    const updated = await updateMemberGuidePayment(payment.referenceId, {
      expiresAt: statusSnapshot.expiresAt ?? payment.expiresAt,
      message: statusSnapshot.message ?? payment.message,
      paymentName: statusSnapshot.paymentName ?? payment.paymentName,
      paymentNumber: statusSnapshot.paymentNumber ?? payment.paymentNumber,
      providerTransactionId: statusSnapshot.providerTransactionId ?? payment.providerTransactionId,
      qrString: statusSnapshot.qrString ?? payment.qrString,
      rawStatusResponse: statusSnapshot.raw ?? null,
      status:
        statusSnapshot.status === "paid" || statusSnapshot.status === "failed"
          ? statusSnapshot.status
          : "pending",
    });

    const isPaid = updated.status === "paid";

    if (isPaid) {
      await consumeAndUnlockGuide(updated);
    }

    return toPublicState(updated, isPaid);
  } else {
    if (!settings.paymenkuApiKey) {
      throw new Error("API key Paymenku belum diatur.");
    }

    const statusSnapshot = await checkPaymenkuTransactionStatus(
      settings.paymenkuApiKey,
      payment.providerTransactionId ?? payment.referenceId,
    );

    const updated = await updateMemberGuidePayment(payment.referenceId, {
      expiresAt: statusSnapshot.expiresAt ?? payment.expiresAt,
      message: statusSnapshot.message ?? payment.message,
      paymentName: statusSnapshot.paymentName ?? payment.paymentName,
      paymentNumber: statusSnapshot.paymentNumber ?? payment.paymentNumber,
      paymentUrl: statusSnapshot.paymentUrl ?? payment.paymentUrl,
      providerTransactionId: statusSnapshot.providerTransactionId ?? payment.providerTransactionId,
      qrImageUrl: statusSnapshot.qrImageUrl ?? payment.qrImageUrl,
      qrString: statusSnapshot.qrString ?? payment.qrString,
      rawStatusResponse: statusSnapshot.raw ?? null,
      status:
        statusSnapshot.status === "paid" || statusSnapshot.status === "failed"
          ? statusSnapshot.status
          : "pending",
    });

    const isPaid = updated.status === "paid";

    if (isPaid) {
      await consumeAndUnlockGuide(updated);
    }

    return toPublicState(updated, isPaid);
  }
}
