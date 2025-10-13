"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { Output } from "@/lib/output-bus"

type SuggestionApply =
  | { type: "replace"; range?: { startLine: number; endLine: number }; code: string }
  | { type: "insert"; range?: { startLine: number }; code: string }
  | { type: "patch"; code: string } // fallback: full code block replacing selected lines elsewhere by user

type Suggestion = {
  title: string
  rationale?: string
  apply?: SuggestionApply
  snippet?: string
}

type AssistantResponse = {
  summary: string
  suggestions: Suggestion[]
  raw?: any
}

export type EditorBridge = {
  getCode: () => string
  setCode: (next: string) => void
  getLanguage: () => string
  revealLine?: (lineNumber: number) => void
  applyEdit?: (apply: SuggestionApply) => void
  highlightRange?: (startLine: number, endLine?: number) => void
  clearHighlights?: () => void
}

export function AIAssistant({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  editor: EditorBridge
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; suggestions?: Suggestion[] }[]
  >([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [optIn, setOptIn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("gradely-ai-log-optin") === "1"
  })
  const [showOptIn, setShowOptIn] = useState(false)
  const [preview, setPreview] = useState<{ suggestion: Suggestion; previewCode: string } | null>(null)

  // Keyboard shortcuts: toggle (Cmd/Ctrl+I), cycle (Alt+])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === "i") {
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.altKey && e.key === "]") {
        e.preventDefault()
        // Focus next suggestion bubble if present
        const next = document.querySelector<HTMLElement>("[data-suggestion]") as HTMLElement | null
        next?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  // Animated arrival cue (CSS handled by Tailwind in globals)
  const containerClass = cn(
    "transition-all duration-300 ease-out",
    open ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none",
  )

  const submit = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    // Privacy: ask once for opt-in to log
    if (!optIn && typeof window !== "undefined") {
      setShowOptIn(true)
    }

    const code = editor.getCode()
    const language = editor.getLanguage()
    setMessages((m) => [...m, { role: "user", content: trimmed }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, code, language }),
      })
      const data: AssistantResponse & { error?: string; info?: string } = await res.json().catch(() => ({}) as any)

      if (!res.ok || data?.error) {
        const detail = data?.error || "Assistant error"
        Output.warning(detail)
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `${detail}. ${
              detail.includes("HUGGINGFACE_OPEN_PERPLEXITY_URL")
                ? "Set HUGGINGFACE_OPEN_PERPLEXITY_URL in Vars or rely on built-in heuristics."
                : "Falling back to heuristics…"
            }`,
          },
        ])
        return
      }

      const assistantText =
        data?.summary ||
        (data?.suggestions?.length
          ? "I proposed a few suggestions you can apply."
          : "I didn't find specific changes. Try asking a more direct question.")
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: assistantText,
          suggestions: data?.suggestions || [],
        },
      ])
      Output.ai(assistantText)
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "There was an error contacting the assistant. Please try again." },
      ])
      Output.error("AI Assistant network error")
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = (s: Suggestion) => {
    if (!s.apply && s.snippet) {
      const current = editor.getCode()
      const lines = current.split("\n")
      const insertLine = Math.max(1, lines.length) // default to append at end
      const next = current.replace(/\s*$/, "") + (current.endsWith("\n") ? "" : "\n") + s.snippet + "\n"

      // Build a synthetic apply so the preview dialog shows proper diff context
      const synthetic: Suggestion = {
        ...s,
        apply: {
          type: "insert",
          range: { startLine: insertLine },
          code: s.snippet,
        },
      }
      setPreview({ suggestion: synthetic, previewCode: next })
      return
    }

    if (!s.apply) return
    // Build preview prior to apply
    const current = editor.getCode()
    let next = current

    if (s.apply.type === "replace") {
      const start = Math.max(1, s.apply.range?.startLine ?? 1)
      const end = Math.max(start, s.apply.range?.endLine ?? start)
      const lines = current.split("\n")
      const before = lines.slice(0, start - 1)
      const after = lines.slice(end)
      next = [...before, s.apply.code, ...after].join("\n")
    } else if (s.apply.type === "insert") {
      const line = Math.max(1, s.apply.range?.startLine ?? 1)
      const lines = current.split("\n")
      const before = lines.slice(0, line)
      const after = lines.slice(line)
      next = [...before, s.apply.code, ...after].join("\n")
    } else if (s.apply.type === "patch") {
      // Fallback: show replacement content, user decides
      next = s.apply.code
    }

    setPreview({ suggestion: s, previewCode: next })
  }

  const confirmApply = () => {
    if (!preview?.suggestion?.apply) return
    // Apply into editor
    editor.setCode(preview.previewCode)
    // Reveal approximate line if provided
    const start = (preview.suggestion.apply as any)?.range?.startLine
    const end = (preview.suggestion.apply as any)?.range?.endLine
    if (typeof start === "number" && editor.revealLine) {
      editor.revealLine(start)
    }
    if (typeof start === "number" && editor.highlightRange) {
      editor.highlightRange(start, typeof end === "number" ? end : start)
      // Optional: clear highlight after a short delay
      setTimeout(() => editor.clearHighlights?.(), 2400)
    }
    setPreview(null)
  }

  return (
    <aside
      aria-label="AI Assistant"
      className={cn(
        "w-full md:w-[360px] lg:w-[420px] h-full md:h-auto",
        "md:border-l md:border-[var(--border)]",
        "bg-[var(--card)] text-[var(--foreground)]",
        "rounded-none md:rounded-l-[var(--radius)]",
        containerClass,
      )}
      role="complementary"
    >
      <Card className="h-full border-0 bg-transparent shadow-none">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="text-balance">AI Assistant</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Hide
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100dvh-12rem)] md:h-[calc(100vh-12rem)] flex flex-col gap-3">
          <ScrollArea className="flex-1 rounded-[var(--radius)] border border-[var(--border)] p-3">
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-[var(--radius)] p-3",
                    m.role === "user"
                      ? "bg-[var(--muted)] ml-auto max-w-[88%]"
                      : "bg-[var(--card-foreground)]/5 mr-auto max-w-[92%] animate-in fade-in slide-in-from-bottom-1",
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  {m.suggestions?.length ? (
                    <div className="mt-3 space-y-2">
                      {m.suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-2"
                          data-suggestion
                          tabIndex={0}
                        >
                          <div className="font-medium">{s.title || "Suggestion"}</div>
                          {s.rationale ? (
                            <div className="text-sm text-[var(--muted-foreground)] mt-1 whitespace-pre-wrap">
                              {s.rationale}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            {s.apply ? (
                              <Button size="sm" onClick={() => applySuggestion(s)}>
                                Apply Suggestion
                              </Button>
                            ) : s.snippet ? (
                              <Button size="sm" onClick={() => applySuggestion(s)}>
                                Insert Snippet
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const toCopy = s.apply?.code ?? s.snippet
                                if (!toCopy) return
                                navigator.clipboard.writeText(toCopy).catch(() => {})
                              }}
                            >
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                Output.ai(s.title || "AI suggestion", {
                                  codeSnippet: s.apply?.code ?? s.snippet ?? undefined,
                                })
                              }
                            >
                              Send to Output
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="mr-auto rounded-[var(--radius)] bg-[var(--card-foreground)]/5 p-3 text-sm">
                  Analyzing your code…
                </div>
              ) : null}
              {!messages.length && (
                <div className="text-sm text-[var(--muted-foreground)]">
                  Tip: Ask “Summarize what my code does,” “Explain the error on line 12,” or “Write a test for the code
                  above.”
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ask the AI Assistant…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
            <Button onClick={submit} disabled={loading}>
              {loading ? "Thinking…" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy opt-in */}
      <AlertDialog open={showOptIn} onOpenChange={setShowOptIn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share code with AI Assistant?</AlertDialogTitle>
            <AlertDialogDescription>
              The assistant reads your current code to provide context-aware help. You can opt-in to log code and
              completions history for better suggestions. You can change this later in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowOptIn(false)}>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowOptIn(false)
                setOptIn(true)
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("gradely-ai-log-optin", "1")
                }
              }}
            >
              Opt in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diff/preview before applying */}
      <AlertDialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes will update your editor. Review them below before applying.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-2">
              <div className="text-xs text-[var(--muted-foreground)] mb-1">Proposed code</div>
              <pre className="overflow-auto text-xs leading-5">{preview?.previewCode}</pre>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPreview(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
