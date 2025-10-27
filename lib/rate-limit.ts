// Simple in-memory rate limiter
// For production, use Redis or a dedicated service like Upstash
const store = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetTime) {
    // New window
    const resetTime = now + windowMs
    store.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  // Increment counter
  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime }
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000,
)
