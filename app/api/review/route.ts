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

function heuristicAnalyze(code: string, language: string): { summary: string; issues: any[] } {
  const lines = code.split("\n")
  const issues: any[] = []
  const push = (line: number, message: string, severity: "info" | "warning" | "error", suggestion?: string) =>
    issues.push({ line: Math.max(1, line || 1), message, severity, suggestion })

  // Simple cross-language heuristics
  lines.forEach((ln, i) => {
    if (/TODO|FIXME/.test(ln)) push(i + 1, "Found TODO/FIXME marker.", "info", "Address the TODO or remove the marker.")
    if (/\bvar\b/.test(ln)) push(i + 1, "Avoid using var.", "warning", "Use let/const for block scoping.")
    if (/console\.log\(/.test(ln)) push(i + 1, "Debug logging detected.", "info", "Remove or gate logs behind a flag.")
  })

  if (language === "python") {
    const hasMain = code.includes('if __name__ == "__main__"')
    if (!hasMain) push(1, "No program entry guard detected.", "info", 'Consider adding if __name__ == "__main__":')
    if (/\t/.test(code)) push(1, "Tab indentation detected.", "warning", "Prefer spaces for Python indentation.")
  } else if (language === "typescript") {
    if (!/:/.test(code) && /\bfunction\b|\bconst\b/.test(code)) {
      push(1, "Missing type annotations.", "info", "Add parameter and return types for clarity.")
    }
  } else if (language === "javascript") {
    if (/==[^=]/.test(code)) push(1, "Loose equality used.", "warning", "Prefer strict equality (===).")
  } else if (language === "html") {
    if (!/<meta charset=/.test(code))
      push(3, "Missing <meta charset>.", "info", 'Add <meta charset="utf-8"> in <head>.')
    if (!/<title>/.test(code)) push(3, "Missing <title> tag.", "info", "Add a <title> for accessibility/SEO.")
  } else if (language === "css") {
    if (!/:root/.test(code)) push(1, "No :root tokens.", "info", "Consider CSS variables for theme tokens.")
  }

  const summary =
    issues.length > 0
      ? "Heuristic analysis found potential improvements. Review inline notes."
      : "Heuristic analysis did not find specific issues. Try asking about tests or refactoring."
  return { summary, issues }
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

    let parsed: ReviewResult | null = null
    try {
      const { text } = await generateText({
        // Using Vercel AI SDK model routing with supported providers
        model: "openai/gpt-5-mini",
        prompt,
      })

      // Attempt to locate JSON in response
      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")
      const jsonStr = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text
      parsed = JSON.parse(jsonStr)
    } catch {
      parsed = null
    }

    if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.issues)) {
      const fallback = heuristicAnalyze(code, String(language || ""))
      return NextResponse.json<ReviewResult>(
        {
          summary: fallback.summary,
          issues: fallback.issues,
        },
        { headers: { "Cache-Control": "no-store" } },
      )
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
    const body = await req.json().catch(() => ({}) as any)
    const fallback = heuristicAnalyze(String(body?.code || ""), String(body?.language || ""))
    return NextResponse.json<ReviewResult>(
      {
        summary: fallback.summary,
        issues: fallback.issues,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }
}
