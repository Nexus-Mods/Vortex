import { z } from "zod";

/**
 * Schema for the decoded JWT access-token payload. This is the single source
 * of truth: IJWTAccessToken is inferred from it via z.infer, so the runtime
 * validation and the static type can never drift apart. Unknown keys (other
 * standard JWT claims) are ignored by default.
 */
export const accessTokenSchema = z.object({
  application_id: z.number(),
  exp: z.number(),
  fingerprint: z.string().optional(),
  iat: z.number(),
  iss: z.string(),
  jti: z.string(),
  sub: z.string(),
  user: z.object({
    group_id: z.number(),
    id: z.number(),
    joined: z.number(),
    membership_roles: z.array(z.string()),
    other_group_ids: z.string(),
    permissions: z.record(z.string(), z.array(z.string())),
    premium_expiry: z.number(),
    age_verified: z.boolean(),
    username: z.string(),
  }),
});

export type IJWTAccessToken = z.infer<typeof accessTokenSchema>;
