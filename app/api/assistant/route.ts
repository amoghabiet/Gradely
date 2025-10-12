import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { prompt, code, language } = body || {}

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400 })
    }

    // Build a system-style context for code-aware assistance
    const system = [
      "You are an in-editor AI coding assistant.",
      "Use bigcode/starcoder2-3b quality for code reasoning and generation.",
      "When suggesting changes, provide clear diffs or exact replacement blocks and include line hints.",
      "Prefer minimal, safe edits. Avoid overwriting entire files unless asked.",
    ].join(" ")

    const payload = {
      // Generic shape expected by many Spaces; adjust if your Space expects different keys
      prompt,
      system,
      language,
      context: code,
      model: "bigcode/starcoder2-3b",
      // Ask the Space to return structured suggestions for safer apply:
      response_format: "json",
      instructions:
        "Return JSON with: { summary: string, suggestions: [{ title: string, rationale: string, apply: { type: 'replace'|'insert'|'patch', range?: { startLine: number, endLine: number }, code?: string } }] }",
      max_tokens: 1024,
      temperature: 0.2,
    }

    const url = process.env.HUGGINGFACE_OPEN_PERPLEXITY_URL
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing HUGGINGFACE_OPEN_PERPLEXITY_URL" }), { status: 500 })
    }

    const hfRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // No credentials, do not forward cookies
    })

    if (!hfRes.ok) {
      const txt = await hfRes.text().catch(() => "")
      return new Response(JSON.stringify({ error: "Upstream error", info: txt }), { status: 502 })
    }

    // Expecting JSON result
    const data = await hfRes.json().catch(async () => {
      const txt = await hfRes.text().catch(() => "")
      return { summary: "", suggestions: [], raw: txt }
    })

    // Normalize shape
    const normalized = {
      summary: data?.summary ?? "",
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
      raw: data,
    }

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Assistant route failure", message: err?.message }), { status: 500 })
  }
}
