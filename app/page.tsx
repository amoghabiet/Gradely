"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CodeEditor, type EditorHandle } from "@/components/gradely/code-editor"
import { ReviewPanel, type ReviewIssue, type ReviewResult } from "@/components/gradely/review-panel"
import { HistoryPanel, type Snapshot } from "@/components/gradely/history-panel"
import { GradelyHeader } from "@/components/gradely/header"
import { AIAssistant } from "@/components/gradely/ai-assistant"
import { OutputWindow } from "@/components/gradely/output-window"
import { Output } from "@/lib/output-bus" // wire Output bus for visible logs

type Lang = "typescript" | "javascript" | "python" | "java" | "c" | "cpp" | "html" | "css"

const DEFAULT_CODE: Record<Lang, string> = {
  typescript: `// Welcome to Gradely!
// Write TypeScript here and click "Analyze Code" for instant AI feedback.

function add(a: number, b: number) {
  return a + b
}

console.log(add(2, 3))
`,
  javascript: `// Welcome to Gradely!
// Write JavaScript here and click "Analyze Code" for instant AI feedback.

function add(a, b) {
  return a + b
}

console.log(add(2, 3))
`,
  python: `# Welcome to Gradely!
# Write Python here and click "Analyze Code" for instant AI feedback.

def add(a, b):
    return a + b

print(add(2, 3))
`,
  java: `// Welcome to Gradely!
// Write Java here and click "Analyze Code" for instant AI feedback.

public class Main {
  static int add(int a, int b) {
    return a + b;
  }
  public static void main(String[] args) {
    System.out.println(add(2, 3));
  }
}
`,
  c: `// Welcome to Gradely!
// Write C here and click "Analyze Code" for instant AI feedback.
#include <stdio.h>

int add(int a, int b) { return a + b; }

int main() {
  printf("%d\\n", add(2, 3));
  return 0;
}
`,
  cpp: `// Welcome to Gradely!
// Write C++ here and click "Analyze Code" for instant AI feedback.
#include <iostream>
int add(int a, int b) { return a + b; }
int main() {
  std::cout << add(2, 3) << std::endl;
  return 0;
}
`,
  html: ` Welcome to Gradely! 
 Write HTML here and click "Analyze Code" for instant AI feedback. 
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Gradely HTML</title></head>
  <body>
    <h1>Hello</h1>
    <p>Try editing this markup.</p>
  </body>
</html>
`,
  css: `/* Welcome to Gradely! */
/* Write CSS here and click "Analyze Code" for instant AI feedback. */
:root { --brand: #0ea5e9; }
h1 { color: var(--brand); font-weight: 700; }
`,
}

export default function HomePage() {
  const [language, setLanguage] = useState<Lang>("typescript")
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState<ReviewIssue[]>([])
  const [assistantOpen, setAssistantOpen] = useState(false) // AI assistant panel state
  const [liveCode, setLiveCode] = useState<string>("") // live code awareness (optional)
  const editorRef = useRef<EditorHandle | null>(null)
  const [snapshotsKey] = useState<string>("gradely:snapshots")

  useEffect(() => {
    if (typeof window === "undefined") return
    // Mark root as ready for reveal styles
    document.documentElement.classList.add("reveal-ready")

    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in-view")
        })
      },
      { threshold: 0.2 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const initialCode = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_CODE[language]
    // try to load last code per language
    const key = `gradely:code:${language}`
    const saved = window.localStorage.getItem(key)
    return saved ?? DEFAULT_CODE[language]
  }, [language])

  const onMountEditor = useCallback((handle: EditorHandle) => {
    editorRef.current = handle
  }, [])

  const handleAnalyze = useCallback(async () => {
    const code = editorRef.current?.getValue() ?? ""
    Output.info("Analyzing code with AI review…", { codeSnippet: code.slice(0, 400), meta: { language } })
    setLoading(true)
    setReview(null)
    setIssues([])
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      })
      const data: ReviewResult = await res.json()
      setReview(data)
      setIssues(data.issues ?? [])
      editorRef.current?.setMarkers(data.issues ?? [])

      const count = data.issues?.length ?? 0
      Output.success(`AI Review complete — ${count} issue${count === 1 ? "" : "s"} found.`)
      if (count === 0) {
        Output.info("No issues detected. Try a different prompt or language settings.")
      } else {
        for (const it of data.issues!) {
          const line = Math.max(1, it.line || 1)
          const msg = `${it.severity?.toUpperCase?.() || "ISSUE"} at line ${line}: ${it.message}`
          if (it.severity === "error") Output.error(msg, { line })
          else if (it.severity === "warning") Output.warning(msg, { line })
          else Output.info(msg, { line })
        }
      }
    } catch (err) {
      console.error("[v0] Review error:", err)
      setReview({
        summary: "Something went wrong while analyzing your code. Please try again.",
        issues: [],
      })
      setIssues([])
      editorRef.current?.setMarkers([])
      Output.error("AI Review failed. Please retry or adjust your code.")
    } finally {
      setLoading(false)
    }
  }, [language])

  const handleSaveSnapshot = useCallback(() => {
    if (typeof window === "undefined") return
    const code = editorRef.current?.getValue() ?? ""
    const newSnap: Snapshot = {
      id: crypto.randomUUID(),
      language,
      code,
      createdAt: Date.now(),
    }
    const existingRaw = window.localStorage.getItem(snapshotsKey)
    const existing: Snapshot[] = existingRaw ? JSON.parse(existingRaw) : []
    const next = [newSnap, ...existing].slice(0, 50) // cap history
    window.localStorage.setItem(snapshotsKey, JSON.stringify(next))
    Output.success("Snapshot saved.", { meta: { language } })
  }, [language, snapshotsKey])

  const handleLoadSnapshot = useCallback((snap: Snapshot) => {
    setLanguage(snap.language as Lang)
    Output.info(`Loaded snapshot (${snap.language}).`)
    setTimeout(() => {
      editorRef.current?.setValue(snap.code)
    }, 0)
  }, [])

  const handleClear = useCallback(() => {
    editorRef.current?.setValue("")
    setReview(null)
    setIssues([])
    editorRef.current?.setMarkers([])
    Output.info("Editor cleared and markers removed.")
  }, [])

  const editorBridge = useMemo(
    () => ({
      getCode: () => editorRef.current?.getValue() ?? "",
      setCode: (next: string) => editorRef.current?.setValue(next),
      getLanguage: () => language,
      revealLine: (line: number) => editorRef.current?.revealLine(line),
      highlightRange: (start: number, end?: number) => (editorRef.current as any)?.addHighlights?.(start, end),
      clearHighlights: () => (editorRef.current as any)?.clearHighlights?.(),
    }),
    [language],
  )

  return (
    <main className="min-h-dvh flex flex-col">
      <GradelyHeader />

      {/* Parallax background layer */}
      <div aria-hidden="true" className="parallax-bg" />

      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-10 md:pt-14 pb-4 md:pb-6">
        <div className="max-w-3xl">
          <h1 className="text-balance text-3xl md:text-5xl font-semibold reveal">
            Instant, in‑browser AI code review.
          </h1>
          <p className="mt-3 md:mt-4 text-pretty text-muted-foreground reveal delay-1">
            Write code. Click Analyze. Get crisp, actionable feedback with inline markers—no setup, no extensions.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8 flex-1 flex flex-col gap-4">
        <Card className="p-4 md:p-6 glass-surface reveal">
          {/* Toolbar row */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground hidden md:block">Write code and get instant AI review</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setAssistantOpen((v) => !v)}>
                {assistantOpen ? "Hide AI Assistant" : "AI Assistant"}
              </Button>
              <Button variant="secondary" onClick={handleSaveSnapshot}>
                Save Snapshot
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading ? "Analyzing…" : "Analyze Code"}
              </Button>
            </div>
          </div>

          {/* Main work area */}
          <div
            className={cn(
              "mt-4 grid gap-4",
              assistantOpen ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1 lg:grid-cols-3",
            )}
          >
            <div className={cn(assistantOpen ? "lg:col-span-2" : "lg:col-span-2")}>
              <CodeEditor
                key={language}
                language={language}
                initialValue={initialCode}
                onMount={onMountEditor}
                storageKey={`gradely:code:${language}`}
                onChange={setLiveCode} // live awareness (optional)
              />
            </div>
            <div className="lg:col-span-1">
              <ReviewPanel
                review={review}
                issues={issues}
                onJumpToLine={(line) => editorRef.current?.revealLine(line)}
              />
            </div>
            {assistantOpen && (
              <div className="lg:col-span-1">
                <AIAssistant open={assistantOpen} onOpenChange={setAssistantOpen} editor={editorBridge} />
              </div>
            )}
          </div>
        </Card>

        {/* Bottom output window, resizable and non-blocking */}
        <OutputWindow onJumpToLine={(line) => editorRef.current?.revealLine(line)} />

        <HistoryPanel storageKey={snapshotsKey} onLoad={handleLoadSnapshot} />
      </section>

      {/* Snap-scrolling features strip */}
      <section className="snap-y snap-mandatory overflow-y-auto max-h-[70vh] border-t" aria-label="Key features">
        <div className="snap-start px-4 py-8 md:py-12 bg-transparent">
          <div className="mx-auto w-full max-w-7xl glass-surface rounded-xl p-6 reveal">
            <h2 className="text-lg font-semibold">Inline AI feedback</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Issues appear right in your editor with jump-to-line and suggestions.
            </p>
          </div>
        </div>
        <div className="snap-start px-4 py-8 md:py-12 bg-transparent">
          <div className="mx-auto w-full max-w-7xl glass-surface rounded-xl p-6 reveal">
            <h2 className="text-lg font-semibold">Multi-language support</h2>
            <p className="text-sm text-muted-foreground mt-2">
              TypeScript, JavaScript, Python, Java, C, C++, HTML, and CSS—switch instantly with one selector.
            </p>
          </div>
        </div>
        <div className="snap-start px-4 py-8 md:py-12 bg-transparent">
          <div className="mx-auto w-full max-w-7xl glass-surface rounded-xl p-6 reveal">
            <h2 className="text-lg font-semibold">Snapshots & history</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Save quick versions to local history and restore with a click.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Built with Gradely — Instant AI code review in your browser
      </footer>
    </main>
  )
}
