import { z } from "zod";

export const normalizedBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(({ x, width }) => x + width <= 1, "Box exceeds the horizontal boundary")
  .refine(({ y, height }) => y + height <= 1, "Box exceeds the vertical boundary");

export type NormalizedBox = z.infer<typeof normalizedBoxSchema>;
