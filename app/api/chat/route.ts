import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { generateText } from "ai"

// Simple in-memory session config for demo purposes.
// In production, persist via an integration (e.g., Edge Config) with proper encryption.
type SessionConfig = {
  hfKey?: string
}
const sessions = new Map<string, SessionConfig>()

function getOrCreateSessionId() {
  const jar = cookies()
  const existing = jar.get("gradelySession")?.value
  if (existing) return existing
  const sid = crypto.randomUUID()
  // Set a cookie for session continuity
  // 7 days, httpOnly off because Next.js constraints; adjust as needed
  jar.set("gradelySession", sid, { path: "/", maxAge: 60 * 60 * 24 * 7 })
  return sid
}

function getSession(): { id: string; cfg: SessionConfig } {
  const id = getOrCreateSessionId()
  if (!sessions.has(id)) sessions.set(id, {})
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { id, cfg: sessions.get(id)! }
}

function parseIntent(
  message: string,
):
  | { kind: "getKey"; model: "open-perplexity" }
  | { kind: "setKey"; model: "open-perplexity"; key: string }
  | { kind: "runFolder" }
  | { kind: "query"; text: string } {
  const m = message.trim()

  // Get key
  if (/get\s+the\s+current\s+api\s+key.*open-?perplexity/i.test(m) || /^get key .*open/i.test(m)) {
    return { kind: "getKey", model: "open-perplexity" }
  }

  // Set key
  const setKey =
    m.match(/update\s+the\s+open-?perplexity\s+api\s+key\s+to\s+(.+)/i) ||
    m.match(/set\s+key\s+open-?perplexity\s*:\s*(.+)/i)
  if (setKey && setKey[1]) {
    const key = setKey[1].trim().replace(/^["']|["']$/g, "")
    return { kind: "setKey", model: "open-perplexity", key }
  }

  // Run folder (UI handled client-side, but we acknowledge)
  if (/^run\b.*\bfolder\b/i.test(m) || /run all .* files in the folder/i.test(m)) {
    return { kind: "runFolder" }
  }

  // Default: forward as query
  return { kind: "query", text: m }
}

async function callOpenPerplexity(prompt: string, hfKey: string | undefined) {
  // Prefer a configurable Space endpoint; fallback to a reasonable default.
  const url =
    process.env.HUGGINGFACE_OPEN_PERPLEXITY_URL ||
    "https://huggingface.co/spaces/vedantdere/open-perplexity/api/predict"

  if (!hfKey) {
    return { ok: false, error: "No Hugging Face token is set for open-perplexity." }
  }

  try {
    // Many Spaces use a Gradio-style payload: { data: [input] }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [prompt] }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, error: `open-perplexity error: ${res.status} ${errText}` }
    }
    const json = await res.json()
    // Try to extract a textual response from common Gradio shapes
    const reply =
      (Array.isArray(json?.data) &&
        json.data.map((d: any) => (typeof d === "string" ? d : JSON.stringify(d))).join("\n")) ||
      json?.text ||
      JSON.stringify(json)
    return { ok: true, text: String(reply) }
  } catch (err: any) {
    return { ok: false, error: `Failed to reach open-perplexity: ${err?.message || String(err)}` }
  }
}

async function fallbackAi(prompt: string) {
  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      prompt,
    })
    return { ok: true as const, text }
  } catch (err: any) {
    return { ok: false as const, error: `AI fallback failed: ${err?.message || String(err)}` }
  }
}

export async function POST(req: NextRequest) {
  const { id, cfg } = getSession()
  const body = await req.json().catch(() => ({}))
  const message: string = (body?.message || "").toString()
  if (!message) {
    return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 })
  }

  const intent = parseIntent(message)

  // Handle intents
  if (intent.kind === "getKey") {
    const masked = cfg.hfKey ? `${mask(cfg.hfKey)}` : "not set"
    return Response.json({
      reply: `The current API key for open-perplexity is ${masked}. Would you like to update it?`,
    })
  }

  if (intent.kind === "setKey") {
    if (!intent.key || intent.key.length < 8) {
      return Response.json({ reply: "That key looks invalid. Please provide a valid Hugging Face token." })
    }
    cfg.hfKey = intent.key
    sessions.set(id, cfg)
    return Response.json({ reply: "API key updated successfully and is now active for open-perplexity." })
  }

  if (intent.kind === "runFolder") {
    return Response.json({
      reply:
        "Running all executable files requires selecting a folder in the client. Click the [Send] message, and I will prompt you with a folder selector to proceed.",
    })
  }

  // Query -> try open-perplexity first, then fallback to AI SDK
  const opp = await callOpenPerplexity(intent.text, cfg.hfKey)
  if (opp.ok) {
    return Response.json({ reply: opp.text })
  }
  const fb = await fallbackAi(
    `You are assisting with code errors, technical clarifications, and debugging. If the user shares code, analyze and explain. Query: ${intent.text}`,
  )
  if (fb.ok) {
    return Response.json({
      reply: `Note: open-perplexity was unavailable (${opp.error}). Returning a fallback answer.\n\n${fb.text}`,
    })
  }
  return new Response(
    JSON.stringify({ error: `Both open-perplexity and fallback failed. ${opp.error}; ${fb.error}` }),
    {
      status: 502,
    },
  )
}

function mask(key: string) {
  if (!key) return "not set"
  if (key.length <= 8) return "••••"
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}
