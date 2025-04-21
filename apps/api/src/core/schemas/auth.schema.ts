import { z } from "zod";

// Validation schemas
export const RegisterValidation = z.object({
  username: z.string().max(60),
  email: z.string().email(),
  password: z.string().min(6).max(255),
  display_name: z.string().optional()
}).strip();

export const LoginValidation = z.object({
  username: z.string().max(60),
  password: z.string().min(6).max(255)
}).strip();
