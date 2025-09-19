import { z } from 'zod';
export const PositiveInt = z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(n => n <= 2 ** 31 - 1, 'Must fit 32-bit');
