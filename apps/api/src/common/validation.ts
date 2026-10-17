import { z } from 'zod';

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(120)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(80),
  shopName: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(120)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

export const columnMappingSchema = z.object({
  orderId: z.string().optional(),
  buyerName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().min(1),
  orderValue: z.string().min(1),
  paymentType: z.string().optional(),
  orderedAt: z.string().optional(),
  outcome: z.string().optional(),
  priorOrders: z.string().optional(),
  priorRtos: z.string().optional(),
  productName: z.string().optional(),
  courier: z.string().optional(),
});

export const previewSchema = z.object({
  csv: z.string().min(1).max(5_000_000),
});

export const importSchema = z.object({
  mode: z.enum(['history', 'pending']),
  csv: z.string().min(1).max(5_000_000),
  mapping: columnMappingSchema,
  source: z.enum(['shopify', 'meesho', 'generic']).optional(),
});

export const manualOrderSchema = z.object({
  externalOrderId: z.string().trim().max(64).optional(),
  buyerName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(1).max(400),
  city: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  orderValue: z.number().positive().max(1_000_000),
  paymentType: z.enum(['cod', 'prepaid']).default('cod'),
  orderedAt: z.string().max(40).optional(),
  priorOrders: z.number().int().min(0).max(10_000).default(0),
  priorRtos: z.number().int().min(0).max(10_000).default(0),
  productName: z.string().trim().max(80).optional().default(''),
  courier: z.string().trim().max(80).optional().default(''),
});

export const outcomeSchema = z.object({
  outcome: z.enum(['confirmed', 'cancelled', 'no_response']),
});

export const shopifyInstallSchema = z.object({
  shop: z.string().trim().min(3).max(120),
});

export const shopifySettingsSchema = z.object({
  rtoTag: z.string().trim().max(40).optional(),
  autoCancelOnBuyerCancel: z.boolean().optional(),
  riskTags: z
    .object({
      high: z.string().trim().min(1).max(40),
      medium: z.string().trim().min(1).max(40),
      low: z.string().trim().min(1).max(40),
    })
    .optional(),
});

export const whatsappSaveSchema = z.object({
  accessToken: z.string().trim().min(20).max(4_000),
  phoneNumberId: z.string().trim().regex(/^\d{6,30}$/),
  wabaId: z.string().trim().regex(/^\d{6,30}$/),
  appSecret: z.string().trim().min(8).max(200).optional(),
});

export const whatsappTestSchema = z.object({
  to: z.string().trim().min(8).max(20),
});

export const whatsappSendSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(50),
});

export const geminiKeySchema = z.object({
  apiKey: z.string().trim().min(20).max(400),
});

export const listQuerySchema = z.object({
  stage: z.enum(['history', 'pending', 'closed']).optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((value) => (value ? Number(value) : 50))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((value) => (value ? Number(value) : 0))
    .pipe(z.number().int().min(0)),
});

export const settingsSchema = z
  .object({
    rtoCostInr: z.number().min(0).max(10_000).optional(),
    messageLanguage: z.enum(['hindi', 'hinglish', 'english']).optional(),
    shopName: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No changes',
  });

export const deleteDataSchema = z.object({
  confirm: z.literal('DELETE'),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE'),
  password: z.string().min(1).max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type ImportInput = z.infer<typeof importSchema>;
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
