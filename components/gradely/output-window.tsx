"use client"

import * as React from "react"
import { outputBus, type OutputEntry } from "@/lib/output-bus"
import { cn } from "@/lib/utils"

type Props = {
  onJumpToLine?: (line: number) => void
  className?: string
}

export function OutputWindow({ onJumpToLine, className }: Props) {
  const [items, setItems] = React.useState<OutputEntry[]>([])
  const [expanded, setExpanded] = React.useState(true)
  const [hidden, setHidden] = React.useState(false)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    return outputBus.on((e) => {
      if (e.type === "append") setItems((prev) => [...prev, e.payload])
      else if (e.type === "clear") setItems([])
      else if (e.type === "toggle-expand") setExpanded((v) => !v)
      else if (e.type === "toggle-hidden") setHidden((v) => !v)
      else if (e.type === "focus") containerRef.current?.focus()
    })
  }, [])

  React.useEffect(() => {
    if (!autoScroll) return
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, autoScroll])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault()
        setExpanded((v) => !v)
      }
      if (e.altKey && e.shiftKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault()
        containerRef.current?.focus()
      }
      if (e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setItems([])
      }
      if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault()
        setHidden((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const copyAll = async () => {
    const text = items
      .map((i) => `[${new Date(i.timestamp ?? Date.now()).toLocaleTimeString()}] ${i.kind.toUpperCase()}: ${i.text}`)
      .join("\n")
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  if (hidden) {
    return (
      <div
        className={cn(
          "mt-2 rounded-md border border-[var(--border-muted)] bg-[var(--panel-bg)] px-3 py-2 text-[var(--fg-muted)]",
          "flex items-center justify-between",
          className,
        )}
      >
        <span className="text-sm font-medium">Output hidden</span>
        <div className="flex items-center gap-2">
          <button className="btn-muted" onClick={() => setHidden(false)} aria-label="Show output">
            Show
          </button>
        </div>
      </div>
    )
  }

  return (
    <section
      role="log"
      aria-live="polite"
      aria-label="Execution output"
      className={cn(
        "mt-3 rounded-lg border border-[var(--border-muted)] bg-[var(--panel-bg)]",
        "shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--fg-strong)]">Output</span>
          <span className="text-xs text-[var(--fg-muted)]">({items.length})</span>
          <span className="sr-only" aria-live="polite">
            {items.length} output entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              aria-label="Auto-scroll to newest output"
            />
            Auto-scroll
          </label>
          <button className="btn-muted" onClick={() => setItems([])} aria-label="Clear output">
            Clear
          </button>
          <button className="btn-muted" onClick={copyAll} aria-label="Copy all output">
            Copy
          </button>
          <button className="btn-muted" onClick={() => setExpanded((v) => !v)} aria-label="Expand or collapse output">
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button className="btn-muted" onClick={() => setHidden(true)} aria-label="Hide output">
            Hide
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        className={cn("overflow-auto px-3", expanded ? "h-48 md:h-64 resize-y" : "h-8", "outline-none")}
      >
        {items.length === 0 ? (
          <p className="py-3 text-sm text-[var(--fg-muted)]">No output yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 py-2">
            {items.map((it) => (
              <li
                key={it.id}
                data-kind={it.kind} // helpful for E2E diagnostics
                className={cn(
                  "rounded-md px-3 py-2 animate-output-fade",
                  it.kind === "error" && "bg-[var(--error-bg)] text-[var(--error-fg)]",
                  it.kind === "warning" && "bg-[var(--warn-bg)] text-[var(--warn-fg)]",
                  it.kind === "success" && "bg-[var(--success-bg)] text-[var(--success-fg)]",
                  it.kind === "info" && "bg-[var(--info-bg)] text-[var(--info-fg)]",
                  it.kind === "ai" && "bg-[var(--ai-bg)] text-[var(--ai-fg)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-[var(--fg-muted)]">
                      {new Date(it.timestamp ?? Date.now()).toLocaleTimeString()} • {it.kind.toUpperCase()}
                    </div>
                    <div className="whitespace-pre-wrap break-words text-sm text-[var(--fg-strong)]">{it.text}</div>
                    {it.codeSnippet ? (
                      <pre className="mt-2 overflow-auto rounded-md border border-[var(--border-muted)] bg-[var(--panel-contrast)] p-2 text-xs">
                        <code>{it.codeSnippet}</code>
                      </pre>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {typeof it.line === "number" && onJumpToLine ? (
                      <button
                        className="btn-muted"
                        onClick={() => onJumpToLine(it.line!)}
                        aria-label={`Jump to line ${it.line}`}
                      >
                        Jump
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
