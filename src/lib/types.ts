import { z } from "zod";

export const TxnSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  postedAt: z.iso.datetime(),
  amountCents: z.number().int().positive(),
  merchant: z.string(),
  cardId: z.string().nullable(),
  cardName: z.string().nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

export type Txn = z.infer<typeof TxnSchema>;

export const LimitTypeSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "fixed",
  "single_use",
]);

export type LimitType = z.infer<typeof LimitTypeSchema>;

export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  last4: z.string(),
  userId: z.string().nullable(),
  holderName: z.string().nullable(),
  limitCents: z.number().nullable(),
  limitType: LimitTypeSchema.nullable(),
  blockedMccs: z.array(z.string()),
  blockedMerchants: z.array(z.string()),
  allowedMccs: z.array(z.string()),
  allowedMerchants: z.array(z.string()),
});

export type Card = z.infer<typeof CardSchema>;

export const MerchantSchema = z.object({
  raw: z.string(),
  canonical: z.string(),
  mcc: z.string(),
  mccName: z.string(),
  isRecurring: z.boolean().optional(),
  confidence: z.number(),
  domain: z.string().nullable().optional(),
  listPriceCents: z.number().nullable().optional(),
  priceUnit: z.enum(["seat", "month"]).nullable().optional(),
});

export type Merchant = z.infer<typeof MerchantSchema>;

export const PolicySchema = z.object({
  maxPerTxnCents: z.number().nullable(),
  monthlyCapCents: z.number().nullable(),
  mode: z.enum(["blocklist", "allowlist"]),
  mccs: z.array(z.string()),
  merchants: z.array(z.string()),
  scope: z.enum(["all", "card", "user"]),
  scopeIds: z.array(z.string()),
});

export type Policy = z.infer<typeof PolicySchema>;

export const VerdictSchema = z.object({
  txn: TxnSchema,
  outcome: z.enum(["pass", "flag", "block"]),
  reasons: z.array(z.string()),
  runningMonthCents: z.number(),
});

export type Verdict = z.infer<typeof VerdictSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "duplicate_subscription",
    "control_leakage",
    "risk_category",
    "no_limit",
    "limit_too_high",
    "spend_acceleration",
  ]),
  title: z.string(),
  detail: z.string(),
  cardId: z.string().nullable(),
  evidenceTxnIds: z.array(z.string()),
  impactCents: z.number(),
  suggested: PolicySchema,
});

export type Finding = z.infer<typeof FindingSchema>;
