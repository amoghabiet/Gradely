// Minimal Monaco Editor wrapper with markers, localStorage persistence, and highlights

"use client"

import Editor, { type OnMount, loader } from "@monaco-editor/react"
import { useCallback, useEffect, useRef, useState } from "react"
import type * as Monaco from "monaco-editor"
import { useDebouncedCallback } from "use-debounce"
import type { ReviewIssue } from "./review-panel"

try {
  loader.config({
    paths: {
      vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs",
    },
  })
} catch (e) {
  console.warn("[v0] Monaco loader config failed:", e)
}

export type EditorHandle = {
  getValue: () => string
  setValue: (code: string) => void
  setMarkers: (issues: ReviewIssue[]) => void
  revealLine: (line: number) => void
  addHighlights: (startLine: number, endLine?: number) => void
  clearHighlights: () => void
  highlightRange?: (startLine: number, endLine?: number) => void
}

export function CodeEditor(props: {
  language: "typescript" | "javascript" | "python" | "java" | "c" | "cpp" | "html" | "css"
  initialValue: string
  storageKey: string
  onMount?: (handle: EditorHandle) => void
  onChange?: (code: string) => void // optional live change callback
}) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const decorationsRef = useRef<string[]>([]) // track highlight decorations
  const [initError, setInitError] = useState<string | null>(null)

  const save = useDebouncedCallback((val: string) => {
    try {
      window.localStorage.setItem(props.storageKey, val)
    } catch {}
  }, 500)

  const onMount: OnMount = useCallback(
    (editor, monaco) => {
      try {
        editorRef.current = editor
        monacoRef.current = monaco

        // Provide an imperative API to parent
        props.onMount?.({
          getValue: () => editor.getValue(),
          setValue: (code) => editor.setValue(code),
          revealLine: (line) => {
            editor.revealLineInCenter(line)
            editor.setPosition({ lineNumber: line, column: 1 })
            editor.focus()
          },
          setMarkers: (issues) => {
            const model = editor.getModel()
            if (!model) return
            const markers: Monaco.editor.IMarkerData[] = (issues || []).map((it) => ({
              startLineNumber: Math.max(1, it.line || 1),
              endLineNumber: Math.max(1, it.line || 1),
              startColumn: 1,
              endColumn: 120,
              message: it.message,
              severity:
                it.severity === "error"
                  ? monaco.MarkerSeverity.Error
                  : it.severity === "warning"
                    ? monaco.MarkerSeverity.Warning
                    : monaco.MarkerSeverity.Info,
              source: "Gradely",
            }))
            monaco.editor.setModelMarkers(model, "gradely", markers)
          },
          addHighlights: (startLine: number, endLine?: number) => {
            const model = editor.getModel()
            if (!model || !monaco) return
            const start = Math.max(1, startLine)
            const end = Math.max(start, endLine ?? start)
            // Remove previous first
            if (decorationsRef.current.length) {
              decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
            }
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
              {
                range: new monaco.Range(start, 1, end, 1),
                options: {
                  isWholeLine: true,
                  className: "gradely-line-highlight",
                  marginClassName: "gradely-line-highlight-margin",
                },
              },
            ])
          },
          clearHighlights: () => {
            if (editor && decorationsRef.current.length) {
              decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
            }
          },
          highlightRange: (startLine: number, endLine?: number) => {
            const model = editor.getModel()
            if (!model || !monaco) return
            const start = Math.max(1, startLine)
            const end = Math.max(start, endLine ?? start)
            if (decorationsRef.current.length) {
              decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
            }
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
              {
                range: new monaco.Range(start, 1, end, 1),
                options: {
                  isWholeLine: true,
                  className: "gradely-line-highlight",
                  marginClassName: "gradely-line-highlight-margin",
                },
              },
            ])
          },
        })

        // Save on change
        editor.onDidChangeModelContent(() => {
          const val = editor.getValue()
          save(val)
          props.onChange?.(val)
        })

        setInitError(null)
      } catch (e) {
        console.error("[v0] Monaco onMount error:", e)
        setInitError("Failed to initialize editor. Please refresh the page.")
      }
    },
    [props, save],
  )

  // Ensure initial value loaded
  useEffect(() => {
    if (!editorRef.current) return
    const current = editorRef.current.getValue()
    if (!current && props.initialValue) {
      editorRef.current.setValue(props.initialValue)
    }
  }, [props.initialValue])

  // Map languages to Monaco ids
  const monacoLang =
    props.language === "typescript"
      ? "typescript"
      : props.language === "javascript"
        ? "javascript"
        : props.language === "python"
          ? "python"
          : props.language === "java"
            ? "java"
            : props.language === "cpp" || props.language === "c"
              ? "cpp"
              : props.language === "html"
                ? "html"
                : "css"

  if (initError) {
    return (
      <div className="rounded-xl border overflow-hidden glass-surface p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-center">
          <p className="text-sm text-red-600 font-medium">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden glass-surface">
      <Editor
        height="60vh"
        language={monacoLang}
        defaultValue={props.initialValue}
        theme="light"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
        }}
        onMount={onMount}
        onError={(error) => {
          console.error("[v0] Monaco error:", error)
          setInitError("Editor failed to load. Please try refreshing.")
        }}
      />
    </div>
  )
}

// Add these classes in globals.css if you want custom colors:
// .gradely-line-highlight { background-color: color-mix(in oklab, var(--accent) 22%, transparent); }
// .gradely-line-highlight-margin { border-left: 3px solid var(--accent); }
