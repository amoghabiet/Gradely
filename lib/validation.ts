import { z } from "zod"

// Review endpoint validation
export const ReviewRequestSchema = z.object({
  code: z.string().min(1, "Code is required").max(50000, "Code exceeds maximum length"),
  language: z.enum(["typescript", "javascript", "python", "java", "c", "cpp", "html", "css"]).default("typescript"),
})

export type ReviewRequest = z.infer<typeof ReviewRequestSchema>

// Assistant endpoint validation
export const AssistantRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt exceeds maximum length"),
  code: z.string().max(50000, "Code exceeds maximum length").default(""),
  language: z.enum(["typescript", "javascript", "python", "java", "c", "cpp", "html", "css"]).default("plaintext"),
})

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>

// Chat endpoint validation
export const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message exceeds maximum length"),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// Generic validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { valid: true; data: T } | { valid: false; error: string } {
  try {
    const validated = schema.parse(data)
    return { valid: true, data: validated }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
      return { valid: false, error: messages }
    }
    return { valid: false, error: "Validation failed" }
  }
}
