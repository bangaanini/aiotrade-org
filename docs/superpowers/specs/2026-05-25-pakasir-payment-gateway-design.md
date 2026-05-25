# Pakasir Payment Gateway Integration Design

**Date:** 2026-05-25  
**Status:** Approved  
**Approach:** Conditional Logic (Fast Implementation)

## Overview

Add Pakasir as an alternative payment gateway provider alongside Paymenku. Admin can choose one active provider via radio button selection. Integration uses Pakasir API to create transactions and display QR/VA numbers directly on the website.

## Requirements

- Admin can select between Paymenku or Pakasir as active provider (radio button, only one active)
- Pakasir configuration: `slug` and `api_key` only
- Admin can select which Pakasir payment methods are active (like Paymenku channel selection)
- Use Pakasir API (not URL redirect) to create transactions
- Display QR codes and VA numbers on the website
- Support both signup payments and member guide payments

## Architecture

### 1. Database Schema Changes

**PaymentGatewaySettings table:**

Add two new nullable columns:
- `pakasir_slug` (String, nullable)
- `pakasir_api_key` (String, nullable)

Existing columns:
- `provider` (String) - values: "paymenku" | "pakasir"
- `paymenku_api_key` (String, nullable)
- `active_channel_codes` (JSON)
- `default_channel_code` (String, nullable)
- `subscription_plans` (JSON)
- Other shared fields remain unchanged

**Migration:**
```sql
ALTER TABLE payment_gateway_settings 
ADD COLUMN pakasir_slug TEXT,
ADD COLUMN pakasir_api_key TEXT;
```

No data migration needed - existing records default to Paymenku.

### 2. Pakasir API Integration

**New file: `lib/pakasir.ts`**

Functions:
1. `createPakasirTransaction(slug, apiKey, input)`
   - Endpoint: `POST https://app.pakasir.com/api/transactioncreate/{method}`
   - Input: `{ amount, orderId, method }`
   - Body: `{ project: slug, order_id: orderId, amount, api_key: apiKey }`
   - Returns: `{ paymentNumber, qrString, expiresAt, providerTransactionId, status }`

2. `checkPakasirTransactionStatus(slug, apiKey, input)`
   - Endpoint: `GET https://app.pakasir.com/api/transactiondetail`
   - Query params: `project, amount, order_id, api_key`
   - Returns: normalized status (`pending`, `paid`, `failed`)

3. `parsePakasirSnapshot(raw)`
   - Helper to normalize Pakasir API response
   - Maps Pakasir status to `NormalizedSignupPaymentStatus`
   - Extracts payment details (VA number, QR string, expiry, etc.)

**Pakasir Payment Methods:**
```typescript
const PAKASIR_METHODS = {
  'bri_va': 'bri_va',
  'bni_va': 'bni_va',
  'cimb_niaga_va': 'cimb_niaga_va',
  'qris': 'qris',
  'sampoerna_va': 'sampoerna_va',
  'bnc_va': 'bnc_va',
  'maybank_va': 'maybank_va',
  'permata_va': 'permata_va',
  'atm_bersama_va': 'atm_bersama_va',
  'artha_graha_va': 'artha_graha_va',
}
```

**Error Handling:**
- Throw Error with clear messages on API failures
- Parse error responses from Pakasir API
- Handle network errors gracefully

### 3. Payment Gateway Configuration

**File: `lib/payment-gateway-config.ts`**

Add Pakasir channels constant:
```typescript
export const PAKASIR_CHANNELS = [
  { code: "bri_va", name: "BRI Virtual Account", type: "va" },
  { code: "bni_va", name: "BNI Virtual Account", type: "va" },
  { code: "cimb_niaga_va", name: "CIMB Niaga Virtual Account", type: "va" },
  { code: "qris", name: "QRIS", type: "qris" },
  { code: "sampoerna_va", name: "Sampoerna Virtual Account", type: "va" },
  { code: "bnc_va", name: "BNC Virtual Account", type: "va" },
  { code: "maybank_va", name: "Maybank Virtual Account", type: "va" },
  { code: "permata_va", name: "Permata Virtual Account", type: "va" },
  { code: "atm_bersama_va", name: "ATM Bersama Virtual Account", type: "va" },
  { code: "artha_graha_va", name: "Artha Graha Virtual Account", type: "va" },
] as const;
```

**File: `lib/payment-gateway-settings.ts`**

Update schema:
```typescript
const paymentGatewaySettingsSchema = z.object({
  provider: z.enum(["paymenku", "pakasir"]),
  
  // Paymenku fields
  paymenkuApiKey: z.string().trim().optional().nullable(),
  
  // Pakasir fields
  pakasirSlug: z.string().trim().optional().nullable(),
  pakasirApiKey: z.string().trim().optional().nullable(),
  
  // Shared fields
  activeChannelCodes: z.array(z.string()),
  defaultChannelCode: z.string().nullable(),
  subscriptionPlans: z.array(subscriptionPlanSchema),
  // ... other shared fields
});
```

**Validation Rules:**
- If `provider === "paymenku"`: require `paymenkuApiKey`
- If `provider === "pakasir"`: require `pakasirSlug` AND `pakasirApiKey`
- `activeChannelCodes` must match selected provider's available channels

**Default Settings:**
```typescript
export const defaultPaymentGatewaySettings = {
  provider: "paymenku", // Keep existing default
  paymenkuApiKey: envPaymenkuApiKey,
  pakasirSlug: null,
  pakasirApiKey: null,
  // ... rest unchanged
};
```

### 4. Business Logic Integration

**Files: `lib/signup-payment.ts` and `lib/member-guide-payments.ts`**

**In `createSignupPayment()` / `createMemberGuidePayment()`:**

```typescript
const settings = await getPaymentGatewaySettings();

if (settings.provider === "pakasir") {
  if (!settings.pakasirSlug || !settings.pakasirApiKey) {
    throw new Error("Pakasir belum dikonfigurasi.");
  }
  
  const transaction = await createPakasirTransaction(
    settings.pakasirSlug,
    settings.pakasirApiKey,
    {
      amount: selectedPlan.price, // or guide.price
      orderId: referenceId,
      method: input.channelCode,
    }
  );
  
  // Save to database with provider: "pakasir"
  await prisma.signupPaymentTransaction.create({
    data: {
      referenceId,
      provider: "pakasir",
      providerTransactionId: transaction.providerTransactionId,
      status: transaction.status,
      channelCode: input.channelCode,
      amount: selectedPlan.price,
      // ... other fields
    }
  });
  
} else {
  // Existing Paymenku logic unchanged
  if (!settings.paymenkuApiKey) {
    throw new Error("Paymenku belum dikonfigurasi.");
  }
  
  const transaction = await createPaymenkuTransaction(
    settings.paymenkuApiKey,
    { /* ... */ }
  );
  
  // Save with provider: "paymenku"
}
```

**In `checkSignupPaymentStatus()` / `checkMemberGuidePaymentStatus()`:**

```typescript
const payment = await getPaymentByReferenceId(referenceId);
const settings = await getPaymentGatewaySettings();

if (payment.provider === "pakasir") {
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
  
  // Update payment status
  
} else {
  // Existing Paymenku logic unchanged
  const statusSnapshot = await checkPaymenkuTransactionStatus(
    settings.paymenkuApiKey,
    payment.providerTransactionId ?? payment.referenceId
  );
}
```

**Database Fields:**
- `provider` field already exists in `SignupPaymentTransaction` and `MemberGuidePaymentTransaction`
- Set to "pakasir" or "paymenku" based on active provider
- No schema changes needed for transaction tables

### 5. Admin UI Updates

**File: `components/admin/payment-settings-view.tsx`**

**Provider Selection (Radio Button):**

Add at the top of the form, before API key fields:

```tsx
<div className="space-y-3">
  <div>
    <p className="text-sm font-semibold text-stone-950">Payment Provider</p>
    <p className="mt-1 text-sm text-stone-600">
      Pilih provider payment gateway yang akan digunakan untuk signup dan member guide payments.
    </p>
  </div>
  
  <div className="grid gap-3 md:grid-cols-2">
    <label className={cn(
      "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition",
      settings.provider === "paymenku" 
        ? "border-sky-300 bg-sky-50/70 shadow-sm"
        : "border-stone-200 hover:border-stone-300"
    )}>
      <input 
        type="radio" 
        name="provider" 
        value="paymenku"
        defaultChecked={settings.provider === "paymenku"}
      />
      <div>
        <span className="block text-sm font-semibold text-stone-950">Paymenku</span>
        <span className="mt-1 block text-xs text-stone-600">
          Payment gateway dengan berbagai metode pembayaran
        </span>
      </div>
    </label>
    
    <label className={cn(
      "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition",
      settings.provider === "pakasir" 
        ? "border-sky-300 bg-sky-50/70 shadow-sm"
        : "border-stone-200 hover:border-stone-300"
    )}>
      <input 
        type="radio" 
        name="provider" 
        value="pakasir"
        defaultChecked={settings.provider === "pakasir"}
      />
      <div>
        <span className="block text-sm font-semibold text-stone-950">Pakasir</span>
        <span className="mt-1 block text-xs text-stone-600">
          Payment gateway lokal dengan fee kompetitif
        </span>
      </div>
    </label>
  </div>
</div>
```

**Conditional Config Fields:**

Use client-side state to show/hide fields based on selected provider:

```tsx
const [selectedProvider, setSelectedProvider] = useState(settings.provider);

// Paymenku API Key (show only if provider === "paymenku")
{selectedProvider === "paymenku" && (
  <div className="grid gap-2">
    <Label htmlFor="paymenkuApiKey">Paymenku API Key</Label>
    <Input
      defaultValue={settings.paymenkuApiKey ?? ""}
      id="paymenkuApiKey"
      name="paymenkuApiKey"
      placeholder="pk_live_xxx"
      type="password"
    />
  </div>
)}

// Pakasir Config (show only if provider === "pakasir")
{selectedProvider === "pakasir" && (
  <>
    <div className="grid gap-2">
      <Label htmlFor="pakasirSlug">Pakasir Project Slug</Label>
      <Input
        defaultValue={settings.pakasirSlug ?? ""}
        id="pakasirSlug"
        name="pakasirSlug"
        placeholder="your-project-slug"
      />
    </div>
    
    <div className="grid gap-2">
      <Label htmlFor="pakasirApiKey">Pakasir API Key</Label>
      <Input
        defaultValue={settings.pakasirApiKey ?? ""}
        id="pakasirApiKey"
        name="pakasirApiKey"
        placeholder="xxx123"
        type="password"
      />
    </div>
  </>
)}
```

**Channel Selection:**

Update to show channels based on selected provider:

```tsx
const availableChannels = selectedProvider === "pakasir" 
  ? PAKASIR_CHANNELS 
  : PAYMENKU_CHANNELS;

<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
  {availableChannels.map((channel) => {
    const Icon = channelIcon(channel.type);
    const checked = settings.activeChannelCodes.includes(channel.code);
    
    return (
      <label key={channel.code} className={/* ... */}>
        <input 
          defaultChecked={checked} 
          name="activeChannelCodes" 
          type="checkbox" 
          value={channel.code} 
        />
        {/* ... channel display */}
      </label>
    );
  })}
</div>
```

**File: `app/(protected)/admin/payments/actions.ts`**

Update validation in `updatePaymentSettingsAction()`:

```typescript
const provider = readString(formData, "provider");

// Validate provider-specific fields
if (provider === "pakasir") {
  const pakasirSlug = readString(formData, "pakasirSlug");
  const pakasirApiKey = readString(formData, "pakasirApiKey");
  
  if (!pakasirSlug || !pakasirApiKey) {
    redirect("/admin/payments?status=error");
  }
  
  // Validate channels are Pakasir channels
  const validPakasirCodes = PAKASIR_CHANNELS.map(c => c.code);
  const invalidChannels = activeChannelCodes.filter(
    code => !validPakasirCodes.includes(code)
  );
  
  if (invalidChannels.length > 0) {
    redirect("/admin/payments?status=error");
  }
  
} else if (provider === "paymenku") {
  const paymenkuApiKey = readString(formData, "paymenkuApiKey");
  
  if (!paymenkuApiKey) {
    redirect("/admin/payments?status=error");
  }
  
  // Validate channels are Paymenku channels
  const validPaymenkuCodes = PAYMENKU_CHANNELS.map(c => c.code);
  const invalidChannels = activeChannelCodes.filter(
    code => !validPaymenkuCodes.includes(code)
  );
  
  if (invalidChannels.length > 0) {
    redirect("/admin/payments?status=error");
  }
}

// Save settings with provider-specific fields
const value: PaymentGatewaySettings = {
  provider,
  paymenkuApiKey: provider === "paymenku" ? paymenkuApiKey : null,
  pakasirSlug: provider === "pakasir" ? pakasirSlug : null,
  pakasirApiKey: provider === "pakasir" ? pakasirApiKey : null,
  // ... other fields
};

await updatePaymentGatewaySettings(value);
```

## Implementation Checklist

### Phase 1: Database & Configuration
- [ ] Create Prisma migration for `pakasir_slug` and `pakasir_api_key` columns
- [ ] Run migration: `npx prisma migrate dev`
- [ ] Add `PAKASIR_CHANNELS` constant to `lib/payment-gateway-config.ts`
- [ ] Update `PaymentGatewaySettings` type in `lib/payment-gateway-settings.ts`
- [ ] Update schema validation to support Pakasir fields
- [ ] Update `normalizeSettings()` to handle Pakasir fields
- [ ] Add environment variable examples to `.env.example`

### Phase 2: Pakasir API Integration
- [ ] Create `lib/pakasir.ts` with API functions
- [ ] Implement `createPakasirTransaction()`
- [ ] Implement `checkPakasirTransactionStatus()`
- [ ] Implement `parsePakasirSnapshot()` helper
- [ ] Add proper TypeScript types for Pakasir responses
- [ ] Test API integration with Pakasir sandbox/production

### Phase 3: Business Logic Updates
- [ ] Update `lib/signup-payment.ts` - add Pakasir conditional logic
- [ ] Update `lib/member-guide-payments.ts` - add Pakasir conditional logic
- [ ] Test signup payment flow with Pakasir
- [ ] Test member guide payment flow with Pakasir
- [ ] Verify payment status checking works for both providers

### Phase 4: Admin UI
- [ ] Update `components/admin/payment-settings-view.tsx`
- [ ] Add provider radio button selection
- [ ] Add conditional rendering for Paymenku/Pakasir config fields
- [ ] Update channel selection to show provider-specific channels
- [ ] Add client-side state management for provider switching
- [ ] Update `app/(protected)/admin/payments/actions.ts` validation
- [ ] Test admin UI - switch between providers
- [ ] Test form submission and validation

### Phase 5: Testing & Verification
- [ ] Test Paymenku flow still works (regression test)
- [ ] Test Pakasir signup payment end-to-end
- [ ] Test Pakasir member guide payment end-to-end
- [ ] Test switching providers in admin panel
- [ ] Test validation errors (missing API keys, invalid channels)
- [ ] Test payment status checking for both providers
- [ ] Verify database records have correct provider field

## Technical Decisions

**Why Conditional Logic over Abstraction?**
- Faster implementation (user chose Approach B)
- Minimal refactoring of existing code
- Straightforward to understand and debug
- Trade-off: Less clean architecture, but acceptable for 2 providers

**Why API Integration over URL Redirect?**
- Better user experience (stay on website)
- More control over payment UI
- Consistent with existing Paymenku implementation
- Trade-off: More complex frontend, but worth it for UX

**Why Radio Button over Toggle?**
- Clearer that only one provider can be active
- Prevents confusion about which provider is actually being used
- Simpler validation logic
- Trade-off: Can't have both active simultaneously, but that's the requirement

## Future Considerations

**If adding more providers:**
- Consider refactoring to Approach A (Provider Abstraction Layer)
- Current conditional logic will become harder to maintain with 3+ providers
- Abstract interface would make testing easier

**Webhook Support:**
- Pakasir supports webhooks via `webhook_url` in project settings
- Current design doesn't include webhook endpoint
- Can be added later if needed for real-time payment notifications

**Sandbox Mode:**
- Pakasir has sandbox mode for testing
- Current design doesn't include sandbox toggle
- Can be added later if needed (separate API keys for sandbox/production)

## Success Criteria

- [ ] Admin can select Paymenku or Pakasir as active provider
- [ ] Admin can configure Pakasir with slug and API key
- [ ] Admin can select active payment methods for Pakasir
- [ ] Signup payment works with Pakasir
- [ ] Member guide payment works with Pakasir
- [ ] Payment status checking works for Pakasir
- [ ] Existing Paymenku functionality remains unchanged
- [ ] No breaking changes to existing payment flows
