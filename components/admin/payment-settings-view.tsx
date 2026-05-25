"use client";

import { useMemo, useState } from "react";
import { CreditCard, Landmark, Plus, QrCode, Trash2, Wallet } from "lucide-react";
import { updatePaymentSettingsAction } from "@/app/(protected)/admin/payments/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdrCurrency, normalizePlanId, PAYMENKU_CHANNELS, PAKASIR_CHANNELS } from "@/lib/payment-gateway-config";
import type { PaymentGatewaySettings } from "@/lib/payment-gateway-settings";
import type { PaymentSubscriptionPlan } from "@/lib/payment-gateway-types";
import { cn } from "@/lib/utils";

type PaymentSettingsViewProps = {
  settings: PaymentGatewaySettings;
  status?: string;
};

function channelTypeLabel(type: (typeof PAYMENKU_CHANNELS)[number]["type"]) {
  if (type === "ewallet") {
    return "E-Wallet";
  }

  if (type === "qris") {
    return "QRIS";
  }

  return "Virtual Account";
}

function channelIcon(type: (typeof PAYMENKU_CHANNELS)[number]["type"]) {
  if (type === "ewallet") {
    return Wallet;
  }

  if (type === "qris") {
    return QrCode;
  }

  return Landmark;
}

function createEmptyPlan() {
  return {
    description: "Akses member standard.",
    durationMonths: 12,
    id: `plan-${Date.now()}`,
    isLifetime: false,
    label: "Paket Baru",
    price: 1000,
  } satisfies PaymentSubscriptionPlan;
}

function createLifetimePlan() {
  return {
    description: "Akses member selamanya tanpa batas masa aktif.",
    durationMonths: 0,
    id: "lifetime",
    isLifetime: true,
    label: "Langganan Lifetime",
    price: 1000,
  } satisfies PaymentSubscriptionPlan;
}

export function PaymentSettingsView({ settings, status }: PaymentSettingsViewProps) {
  const [plans, setPlans] = useState<PaymentSubscriptionPlan[]>(settings.subscriptionPlans);
  const [defaultPlanId, setDefaultPlanId] = useState(settings.defaultPlanId);
  const [provider, setProvider] = useState<"paymenku" | "pakasir">(settings.provider);

  const normalizedPlans = useMemo(
    () =>
      plans.map((plan, index) => ({
        ...plan,
        description: plan.description.trim() || "Akses member standard.",
        durationMonths: plan.isLifetime ? 0 : Math.max(1, Number(plan.durationMonths) || 1),
        id: normalizePlanId(plan.id || plan.label) || `plan-${index + 1}`,
        isLifetime: Boolean(plan.isLifetime),
        label: plan.label.trim() || `Paket ${index + 1}`,
        price: Math.max(1000, Number(plan.price) || 1000),
      })),
    [plans],
  );
  const hasLifetimePlan = normalizedPlans.some((plan) => plan.isLifetime);

  const activeChannels = provider === "pakasir" ? PAKASIR_CHANNELS : PAYMENKU_CHANNELS;

  const effectiveDefaultPlan =
    normalizedPlans.find((plan) => plan.id === defaultPlanId) ?? normalizedPlans[0];

  function updatePlan(index: number, patch: Partial<PaymentSubscriptionPlan>) {
    setPlans((current) => current.map((plan, currentIndex) => (currentIndex === index ? { ...plan, ...patch } : plan)));
  }

  function removePlan(index: number) {
    setPlans((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);

      if (!next.length) {
        return current;
      }

      const removedPlan = current[index];

      if (removedPlan && normalizePlanId(removedPlan.id) === defaultPlanId) {
        setDefaultPlanId(normalizePlanId(next[0]?.id));
      }

      return next;
    });
  }

  function addPlan() {
    const nextPlan = createEmptyPlan();
    setPlans((current) => [...current, nextPlan]);

    if (!defaultPlanId) {
      setDefaultPlanId(normalizePlanId(nextPlan.id));
    }
  }

  function toggleLifetimePlan(enabled: boolean) {
    setPlans((current) => {
      const withoutLifetime = current.filter((plan) => !plan.isLifetime);

      if (!enabled) {
        return withoutLifetime.length ? withoutLifetime : current;
      }

      if (current.some((plan) => plan.isLifetime)) {
        return current;
      }

      return [...withoutLifetime, createLifetimePlan()];
    });

    if (!enabled && normalizedPlans.some((plan) => plan.id === defaultPlanId && plan.isLifetime)) {
      const firstNonLifetime =
        normalizedPlans.find((plan) => !plan.isLifetime)?.id ??
        normalizedPlans.find((plan) => plan.id !== defaultPlanId)?.id ??
        "";
      setDefaultPlanId(firstNonLifetime);
    }
  }

  return (
    <div className="space-y-6">
      {status === "saved" ? <Alert variant="success">Payment settings berhasil diperbarui.</Alert> : null}
      {status === "error" ? (
        <Alert variant="error">Payment settings belum valid. Cek API key, channel aktif, dan paket langganan default.</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payment Gateway Settings</CardTitle>
          <CardDescription>
            Kelola payment gateway (Paymenku atau Pakasir), metode pembayaran aktif, dan pilihan langganan yang akan dipakai di signup serta menu
            langganan member.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Status Gateway</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CreditCard className="h-6 w-6 text-sky-600" />
              {settings.isEnabled ? "Aktif" : "Nonaktif"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Paket Default</CardDescription>
            <CardTitle className="text-2xl">{effectiveDefaultPlan?.label ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Harga Default</CardDescription>
            <CardTitle className="text-3xl">
              {effectiveDefaultPlan ? formatIdrCurrency(effectiveDefaultPlan.price) : "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Jumlah Paket</CardDescription>
            <CardTitle className="text-3xl">{normalizedPlans.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signup Checkout</CardTitle>
          <CardDescription>
            Komponen pembayaran akan muncul di bawah form signup. Data email, username, dan nomor WhatsApp diambil dari
            field yang diisi user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePaymentSettingsAction} className="space-y-6">
            <input name="subscriptionPlans" type="hidden" value={JSON.stringify(normalizedPlans)} />
            <input name="defaultPlanId" type="hidden" value={normalizePlanId(defaultPlanId || effectiveDefaultPlan?.id)} />
            <input name="provider" type="hidden" value={provider} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Aktifkan Payment Gateway</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Saat aktif, user wajib membuat pembayaran dulu sebelum tombol buat akun bisa dipakai.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input defaultChecked={settings.isEnabled} name="isEnabled" type="checkbox" value="true" />
                    Aktif
                  </label>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Pilih Provider</Label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      checked={provider === "paymenku"}
                      onChange={() => setProvider("paymenku")}
                      type="radio"
                      name="providerRadio"
                    />
                    Paymenku
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      checked={provider === "pakasir"}
                      onChange={() => setProvider("pakasir")}
                      type="radio"
                      name="providerRadio"
                    />
                    Pakasir
                  </label>
                </div>
              </div>
            </div>

            {provider === "paymenku" ? (
              <div className="grid gap-2">
                <Label htmlFor="paymenkuApiKey">Paymenku API Key</Label>
                <Input
                  defaultValue={settings.paymenkuApiKey ?? ""}
                  id="paymenkuApiKey"
                  name="paymenkuApiKey"
                  placeholder="pk_live_xxx"
                  type="password"
                />
                <p className="text-xs text-stone-500">Disimpan server-side untuk create transaction dan check status.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pakasirSlug">Pakasir Slug</Label>
                  <Input
                    defaultValue={settings.pakasirSlug ?? ""}
                    id="pakasirSlug"
                    name="pakasirSlug"
                    placeholder="your-project-slug"
                    type="text"
                  />
                  <p className="text-xs text-stone-500">Slug project Pakasir Anda.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pakasirApiKey">Pakasir API Key</Label>
                  <Input
                    defaultValue={settings.pakasirApiKey ?? ""}
                    id="pakasirApiKey"
                    name="pakasirApiKey"
                    placeholder="your-api-key"
                    type="password"
                  />
                  <p className="text-xs text-stone-500">API key untuk autentikasi Pakasir.</p>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="checkoutNote">Catatan Checkout di Signup</Label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                defaultValue={settings.checkoutNote}
                id="checkoutNote"
                name="checkoutNote"
                rows={4}
              />
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Paket Lifetime</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Aktifkan jika Anda ingin menampilkan opsi langganan lifetime di signup dan dashboard member.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      checked={hasLifetimePlan}
                      onChange={(event) => toggleLifetimePlan(event.target.checked)}
                      type="checkbox"
                    />
                    Aktif
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">Pilihan Langganan</p>
                  <p className="mt-1 text-sm text-stone-600">
                    Paket ini dipakai di signup dan ditampilkan lagi di menu langganan member. Default awal adalah 1 tahun.
                  </p>
                </div>
                <Button onClick={addPlan} type="button" variant="outline">
                  <Plus className="h-4 w-4" />
                  Tambah Paket
                </Button>
              </div>

              <div className="space-y-4">
                {plans.map((plan, index) => {
                  const normalizedId = normalizePlanId(plan.id || plan.label) || `plan-${index + 1}`;
                  const isDefault = (defaultPlanId || effectiveDefaultPlan?.id) === normalizedId;

                  return (
                    <div className="rounded-xl border border-stone-200 bg-white p-4" key={`${normalizedId}-${index}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-950">Paket {index + 1}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">{normalizedId}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {plan.isLifetime ? (
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sky-700">
                              Lifetime
                            </span>
                          ) : null}
                          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                            <input
                              checked={isDefault}
                              onChange={() => setDefaultPlanId(normalizedId)}
                              type="radio"
                            />
                            Default
                          </label>
                          <Button
                            disabled={plans.length === 1}
                            onClick={() => removePlan(index)}
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Nama Paket</Label>
                          <Input
                            onChange={(event) => updatePlan(index, { label: event.target.value })}
                            value={plan.label}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>ID Paket</Label>
                          <Input
                            onChange={(event) => updatePlan(index, { id: event.target.value })}
                            value={plan.id}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Durasi</Label>
                          {plan.isLifetime ? (
                            <div className="flex h-11 items-center rounded-lg border border-stone-300 bg-stone-50 px-3 text-sm font-medium text-stone-700">
                              Lifetime
                            </div>
                          ) : (
                            <Input
                              min={1}
                              onChange={(event) =>
                                updatePlan(index, { durationMonths: Number.parseInt(event.target.value || "1", 10) })
                              }
                              type="number"
                              value={String(plan.durationMonths)}
                            />
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label>Harga</Label>
                          <Input
                            min={1000}
                            onChange={(event) => updatePlan(index, { price: Number.parseInt(event.target.value || "1000", 10) })}
                            type="number"
                            value={String(plan.price)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Label>Deskripsi Paket</Label>
                        <textarea
                          className="min-h-20 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                          onChange={(event) => updatePlan(index, { description: event.target.value })}
                          rows={3}
                          value={plan.description}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-stone-950">Channel Pembayaran Aktif</p>
                <p className="mt-1 text-sm text-stone-600">
                  Pilih channel yang ingin muncul di checkout signup. Default channel akan ditandai sebagai rekomendasi.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeChannels.map((channel) => {
                  const Icon = channelIcon(channel.type);
                  const checked = settings.activeChannelCodes.includes(channel.code);

                  return (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition",
                        checked
                          ? "border-sky-300 bg-sky-50/70 shadow-sm"
                          : "border-stone-200 hover:border-stone-300 hover:bg-stone-50",
                      )}
                      key={channel.code}
                    >
                      <input defaultChecked={checked} name="activeChannelCodes" type="checkbox" value={channel.code} />
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-950">{channel.name}</span>
                        <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-stone-500">
                          {channelTypeLabel(channel.type)}
                        </span>
                        <span className="mt-2 block text-xs font-mono text-stone-500">{channel.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 md:max-w-sm">
              <Label htmlFor="defaultChannelCode">Default Channel</Label>
              <select
                className="h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                defaultValue={settings.defaultChannelCode ?? ""}
                id="defaultChannelCode"
                name="defaultChannelCode"
              >
                {activeChannels.map((channel) => (
                  <option key={channel.code} value={channel.code}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit">Simpan Payment Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
