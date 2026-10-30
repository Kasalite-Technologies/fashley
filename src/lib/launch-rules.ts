import { z } from 'zod';
export const MIN_PASSWORD_LENGTH = 8;
export const signupSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(MIN_PASSWORD_LENGTH), agreed: z.literal(true) });
export const notificationSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), section: z.enum(['outfits', 'fabric']) });
