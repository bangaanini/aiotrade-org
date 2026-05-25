import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  normalizePlanId,
  PAYMENKU_CHANNELS,
  PAKASIR_CHANNELS,
} from "@/lib/payment-gateway-config";
import type {
  PaymentSubscriptionPlan,
  PublicSignupPaymentSettings,
} from "@/lib/payment-gateway-types";

const PAYMENT_GATEWAY_SETTINGS_ID = "signup";
const envPaymenkuApiKey =
  process.env.PAYMENKU_API_KEY?.trim() ||
  process.env.PAYMENKU_APIKEY?.trim() ||
  null;

const paymenkuChannelCodes = PAYMENKU_CHANNELS.map((channel) => channel.code);
const pakasirChannelCodes = PAKASIR_CHANNELS.map((channel) => channel.code);
const defaultSubscriptionPlans = DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan }));

const subscriptionPlanSchema = z.object({
  description: z.string().trim().min(1),
  durationMonths: z.number().int().min(0),
  id: z.string().trim().min(1).transform((value) => normalizePlanId(value)),
  isLifetime: z.boolean().default(false),
  label: z.string().trim().min(1),
  price: z.number().int().min(1000),
}).superRefine((plan, ctx) => {
  if (plan.isLifetime && plan.durationMonths !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Paket lifetime harus memakai durasi 0 bulan.",
      path: ["durationMonths"],
    });
  }

  if (!plan.isLifetime && plan.durationMonths < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Durasi paket minimal 1 bulan.",
      path: ["durationMonths"],
    });
  }
});

const paymentGatewaySettingsSchema = z.object({
  activeChannelCodes: z.array(z.string()).default([]),
  checkoutNote: z.string().trim().min(1),
  defaultChannelCode: z.string().nullable(),
  defaultPlanId: z.string().trim().min(1).transform((value) => normalizePlanId(value)),
  isEnabled: z.boolean(),
  paymenkuApiKey: z.string().trim().optional().nullable(),
  pakasirSlug: z.string().trim().optional().nullable(),
  pakasirApiKey: z.string().trim().optional().nullable(),
  priceLabel: z.string().trim().min(1),
  provider: z.enum(["paymenku", "pakasir"]),
  registrationPrice: z.number().int().min(1000),
  subscriptionPlans: z.array(subscriptionPlanSchema).min(1),
});

export type PaymentGatewaySettings = z.infer<typeof paymentGatewaySettingsSchema>;

export const defaultPaymentGatewaySettings: PaymentGatewaySettings = {
  activeChannelCodes: ["bri_va", "bni_va", "qris", "dana", "mandiri_va", "linkaja"],
  checkoutNote: "Pilih metode pembayaran yang tersedia untuk menyelesaikan pendaftaran.",
  defaultChannelCode: "qris",
  defaultPlanId: "1-year",
  isEnabled: true,
  paymenkuApiKey: envPaymenkuApiKey,
  pakasirSlug: null,
  pakasirApiKey: null,
  priceLabel: "1 Tahun",
  provider: "paymenku",
  registrationPrice: 100000,
  subscriptionPlans: defaultSubscriptionPlans,
};

function hasPaymentGatewaySettingsDelegate() {
  return (
    "paymentGatewaySettings" in prisma &&
    typeof prisma.paymentGatewaySettings?.findUnique === "function" &&
    typeof prisma.paymentGatewaySettings?.upsert === "function"
  );
}

function normalizeSettings(value: unknown): PaymentGatewaySettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parsedPlans = Array.isArray(raw.subscriptionPlans)
    ? raw.subscriptionPlans
        .map((item) => subscriptionPlanSchema.safeParse(item))
        .filter((result): result is { success: true; data: PaymentSubscriptionPlan } => result.success)
        .map((result) => result.data)
    : [];
  const hasRawPlanOverrides =
    typeof raw.priceLabel === "string" ||
    typeof raw.registrationPrice === "number" ||
    typeof raw.defaultPlanId === "string";
  const fallbackPlans = parsedPlans.length
    ? parsedPlans
    : hasRawPlanOverrides
      ? [
          {
            description:
              typeof raw.priceLabel === "string"
                ? `Paket default untuk ${raw.priceLabel}.`
                : defaultSubscriptionPlans[0].description,
            durationMonths: defaultSubscriptionPlans[0].durationMonths,
            id: normalizePlanId(
              typeof raw.defaultPlanId === "string" && raw.defaultPlanId
                ? raw.defaultPlanId
                : defaultSubscriptionPlans[0].id,
            ),
            isLifetime: false,
            label:
              typeof raw.priceLabel === "string" && raw.priceLabel.trim()
                ? raw.priceLabel.trim()
                : defaultSubscriptionPlans[0].label,
            price:
              typeof raw.registrationPrice === "number"
                ? raw.registrationPrice
                : defaultSubscriptionPlans[0].price,
          },
        ]
      : defaultSubscriptionPlans;
  const parsed = paymentGatewaySettingsSchema.safeParse({
    activeChannelCodes: Array.isArray(raw.activeChannelCodes)
      ? raw.activeChannelCodes.filter((item): item is string => typeof item === "string")
      : defaultPaymentGatewaySettings.activeChannelCodes,
    checkoutNote: typeof raw.checkoutNote === "string" ? raw.checkoutNote : defaultPaymentGatewaySettings.checkoutNote,
    defaultChannelCode:
      typeof raw.defaultChannelCode === "string" || raw.defaultChannelCode === null
        ? raw.defaultChannelCode
        : defaultPaymentGatewaySettings.defaultChannelCode,
    defaultPlanId:
      typeof raw.defaultPlanId === "string" ? raw.defaultPlanId : defaultPaymentGatewaySettings.defaultPlanId,
    isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : defaultPaymentGatewaySettings.isEnabled,
    paymenkuApiKey:
      typeof raw.paymenkuApiKey === "string" || raw.paymenkuApiKey === null
        ? raw.paymenkuApiKey
        : envPaymenkuApiKey,
    pakasirSlug:
      typeof raw.pakasirSlug === "string" || raw.pakasirSlug === null
        ? raw.pakasirSlug
        : null,
    pakasirApiKey:
      typeof raw.pakasirApiKey === "string" || raw.pakasirApiKey === null
        ? raw.pakasirApiKey
        : null,
    priceLabel: typeof raw.priceLabel === "string" ? raw.priceLabel : defaultPaymentGatewaySettings.priceLabel,
    provider: typeof raw.provider === "string" ? raw.provider : defaultPaymentGatewaySettings.provider,
    registrationPrice:
      typeof raw.registrationPrice === "number"
        ? raw.registrationPrice
        : defaultPaymentGatewaySettings.registrationPrice,
    subscriptionPlans: fallbackPlans,
  });

  if (!parsed.success) {
    return defaultPaymentGatewaySettings;
  }

  const activeChannelCodes = parsed.data.activeChannelCodes.length
    ? parsed.data.activeChannelCodes
    : defaultPaymentGatewaySettings.activeChannelCodes;
  const defaultChannelCode = activeChannelCodes.includes(parsed.data.defaultChannelCode ?? "")
    ? parsed.data.defaultChannelCode
    : activeChannelCodes[0] ?? null;
  const dedupedPlans = parsed.data.subscriptionPlans.reduce<PaymentSubscriptionPlan[]>((accumulator, plan) => {
    if (accumulator.some((item) => item.id === plan.id)) {
      return accumulator;
    }

    accumulator.push({
      ...plan,
      durationMonths: plan.isLifetime ? 0 : Math.max(1, plan.durationMonths),
      isLifetime: Boolean(plan.isLifetime),
    });
    return accumulator;
  }, []);
  const subscriptionPlans = dedupedPlans.length ? dedupedPlans : defaultSubscriptionPlans;
  const defaultPlan =
    subscriptionPlans.find((plan) => plan.id === parsed.data.defaultPlanId) ??
    subscriptionPlans[0] ??
    defaultSubscriptionPlans[0];

  return {
    ...parsed.data,
    activeChannelCodes,
    defaultChannelCode,
    defaultPlanId: defaultPlan.id,
    paymenkuApiKey: parsed.data.paymenkuApiKey?.trim() || envPaymenkuApiKey,
    pakasirSlug: parsed.data.pakasirSlug?.trim() || null,
    pakasirApiKey: parsed.data.pakasirApiKey?.trim() || null,
    priceLabel: defaultPlan.label,
    registrationPrice: defaultPlan.price,
    subscriptionPlans,
  };
}

export async function getPaymentGatewaySettings(): Promise<PaymentGatewaySettings> {
  try {
    const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
      SELECT to_regclass('public.payment_gateway_settings')::text AS "tableName"
    `;

    if (!tables[0]?.tableName) {
      return defaultPaymentGatewaySettings;
    }

    const record = hasPaymentGatewaySettingsDelegate()
      ? await prisma.paymentGatewaySettings.findUnique({
          where: { id: PAYMENT_GATEWAY_SETTINGS_ID },
          select: {
            activeChannelCodes: true,
            checkoutNote: true,
            defaultChannelCode: true,
            defaultPlanId: true,
            isEnabled: true,
            paymenkuApiKey: true,
            pakasirSlug: true,
            pakasirApiKey: true,
            priceLabel: true,
            provider: true,
            registrationPrice: true,
            subscriptionPlans: true,
          },
        })
      : (
          await prisma.$queryRaw<Array<{
            activeChannelCodes: unknown;
            checkoutNote: string;
            defaultChannelCode: string | null;
            defaultPlanId: string;
            isEnabled: boolean;
            paymenkuApiKey: string | null;
            pakasirSlug: string | null;
            pakasirApiKey: string | null;
            priceLabel: string;
            provider: string;
            registrationPrice: number;
            subscriptionPlans: unknown;
          }>>`
            SELECT
              "active_channel_codes" AS "activeChannelCodes",
              "checkout_note" AS "checkoutNote",
              "default_channel_code" AS "defaultChannelCode",
              "default_plan_id" AS "defaultPlanId",
              "is_enabled" AS "isEnabled",
              "paymenku_api_key" AS "paymenkuApiKey",
              "pakasir_slug" AS "pakasirSlug",
              "pakasir_api_key" AS "pakasirApiKey",
              "price_label" AS "priceLabel",
              "provider",
              "registration_price" AS "registrationPrice",
              "subscription_plans" AS "subscriptionPlans"
            FROM "public"."payment_gateway_settings"
            WHERE "id" = ${PAYMENT_GATEWAY_SETTINGS_ID}
            LIMIT 1
          `
        )[0] ?? null;

    return normalizeSettings(record);
  } catch (error) {
    console.error("[payment-gateway-settings] Failed to load settings, using defaults.", error);
    return defaultPaymentGatewaySettings;
  }
}

export async function updatePaymentGatewaySettings(value: PaymentGatewaySettings) {
  const parsed = normalizeSettings(value);

  if (hasPaymentGatewaySettingsDelegate()) {
    await prisma.paymentGatewaySettings.upsert({
      where: { id: PAYMENT_GATEWAY_SETTINGS_ID },
      create: {
        id: PAYMENT_GATEWAY_SETTINGS_ID,
        ...parsed,
      },
      update: parsed,
    });

    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "public"."payment_gateway_settings" (
      "id",
      "provider",
      "is_enabled",
      "paymenku_api_key",
      "pakasir_slug",
      "pakasir_api_key",
      "active_channel_codes",
      "default_channel_code",
      "subscription_plans",
      "default_plan_id",
      "registration_price",
      "price_label",
      "checkout_note"
    )
    VALUES (
      ${PAYMENT_GATEWAY_SETTINGS_ID},
      ${parsed.provider},
      ${parsed.isEnabled},
      ${parsed.paymenkuApiKey},
      ${parsed.pakasirSlug},
      ${parsed.pakasirApiKey},
      ${JSON.stringify(parsed.activeChannelCodes)}::jsonb,
      ${parsed.defaultChannelCode},
      ${JSON.stringify(parsed.subscriptionPlans)}::jsonb,
      ${parsed.defaultPlanId},
      ${parsed.registrationPrice},
      ${parsed.priceLabel},
      ${parsed.checkoutNote}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "provider" = EXCLUDED."provider",
      "is_enabled" = EXCLUDED."is_enabled",
      "paymenku_api_key" = EXCLUDED."paymenku_api_key",
      "pakasir_slug" = EXCLUDED."pakasir_slug",
      "pakasir_api_key" = EXCLUDED."pakasir_api_key",
      "active_channel_codes" = EXCLUDED."active_channel_codes",
      "default_channel_code" = EXCLUDED."default_channel_code",
      "subscription_plans" = EXCLUDED."subscription_plans",
      "default_plan_id" = EXCLUDED."default_plan_id",
      "registration_price" = EXCLUDED."registration_price",
      "price_label" = EXCLUDED."price_label",
      "checkout_note" = EXCLUDED."checkout_note",
      "updated_at" = CURRENT_TIMESTAMP
  `;
}

export async function getPublicSignupPaymentSettings(): Promise<PublicSignupPaymentSettings> {
  const settings = await getPaymentGatewaySettings();

  const allChannels = settings.provider === "pakasir" ? PAKASIR_CHANNELS : PAYMENKU_CHANNELS;

  return {
    activeChannels: allChannels.filter((channel) => settings.activeChannelCodes.includes(channel.code)),
    checkoutNote: settings.checkoutNote,
    defaultChannelCode: settings.defaultChannelCode,
    defaultPlanId: settings.defaultPlanId,
    isEnabled: settings.isEnabled,
    plans: settings.subscriptionPlans,
    priceLabel: settings.priceLabel,
    provider: settings.provider,
    registrationPrice: settings.registrationPrice,
  };
}
