import { z } from "zod";

export const requestAccessSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required"),
});

export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export type LoginInput = z.infer<typeof loginSchema>;
