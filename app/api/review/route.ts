import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"

type ReviewIssue = {
  line: number
  message: string
  severity: "info" | "warning" | "error"
  suggestion?: string
}

type ReviewResult = {
  summary: string
  issues: ReviewIssue[]
}

export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json()
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json<ReviewResult>({
        summary: "No code provided.",
        issues: [],
      })
    }

    // Prompt the model to return a compact JSON payload
    const prompt = `
You are a senior code reviewer. Analyze the following ${language} code and return STRICT JSON only.
Rules:
- Provide a concise "summary" (1-3 sentences).
- Provide up to 8 "issues". Each issue must include: line (1-based), message, severity ("info" | "warning" | "error"), and optional suggestion.
- Focus on correctness, clarity, and performance. If line numbers are unclear, estimate reasonably.

Return JSON exactly:
{
  "summary": "...",
  "issues": [
    { "line": 1, "message": "...", "severity": "warning", "suggestion": "..." }
  ]
}

Code:
---
${code}
---
`

    const { text } = await generateText({
      // Using Vercel AI SDK model routing with supported providers
      model: "openai/gpt-5-mini",
      prompt,
    })

    let parsed: ReviewResult | null = null
    try {
      // Attempt to locate JSON in response
      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")
      const jsonStr = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text
      parsed = JSON.parse(jsonStr)
    } catch {
      parsed = null
    }

    if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.issues)) {
      // Fallback: basic summary, no inline issues
      return NextResponse.json<ReviewResult>({
        summary: "AI returned an unexpected format. Here is a brief summary:\n" + text.slice(0, 500),
        issues: [],
      })
    }

    // Sanitize issues
    const issues = (parsed.issues as any[]).slice(0, 8).map((i) => ({
      line: Math.max(1, Number(i.line) || 1),
      message: String(i.message || "Potential issue"),
      severity: (["info", "warning", "error"].includes(i.severity) ? i.severity : "info") as
        | "info"
        | "warning"
        | "error",
      suggestion: i.suggestion ? String(i.suggestion) : undefined,
    }))

    const result: ReviewResult = {
      summary: parsed.summary,
      issues,
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json<ReviewResult>({
      summary: "Unexpected error while analyzing code. Please try again.",
      issues: [],
    })
  }
}
