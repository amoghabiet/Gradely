"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

function maskKey(k?: string | null) {
  if (!k) return "not set"
  if (k.length <= 8) return "••••"
  return `${k.slice(0, 4)}••••${k.slice(-4)}`
}

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content:
        "Hi! I’m the Gradely assistant. I can help with code questions (powered by open-perplexity), manage model API keys, and run all code files in a folder. Try:\n- “Get the current API key for open-perplexity.”\n- “Update the open-perplexity API key to <your key>.”\n- “Run all Python files in the folder project/submissions.”",
    },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Handle folder run trigger phrase -> open folder picker when user asks to run folder
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return
    if (last.role === "assistant" && last.content.includes("[Select a folder]")) {
      // focus a hint if needed
    }
  }, [messages])

  async function sendToServer(text: string) {
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Request failed")
      }
      const reply = typeof data?.reply === "string" ? data.reply : JSON.stringify(data)
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply }])
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I hit an error: ${err?.message || String(err)}.`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const text = input.trim()
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text }])
    setInput("")

    // If the user is asking to run a folder, prompt for selection
    if (/^run\b.*\bfolder\b/i.test(text) || /run all .* files in the folder/i.test(text)) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Running folder requested. Please select a directory to execute. [Select a folder]",
        },
      ])
      fileInputRef.current?.click()
      return
    }

    await sendToServer(text)
  }

  // Folder execution: JS/TS via Worker sandbox, Python via Pyodide (WASM). Consolidate logs.
  async function runFolder(files: FileList) {
    setBusy(true)
    const logs: string[] = []
    logs.push(`Discovered ${files.length} files in the selected folder.`)

    // Separate by extension
    const jsTsFiles: File[] = []
    const pyFiles: File[] = []
    for (const f of Array.from(files)) {
      if (/\.(js|mjs|cjs|ts|tsx)$/.test(f.name)) jsTsFiles.push(f)
      else if (/\.py$/.test(f.name)) pyFiles.push(f)
    }

    // JS/TS sandbox via Worker
    async function runJsTs() {
      if (jsTsFiles.length === 0) return
      const workerCode = `
        self.onmessage = async (e) => {
          const { id, name, code } = e.data
          const outputs = []
          const originalLog = console.log
          console.log = (...args) => {
            outputs.push({ type: "log", text: args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") })
          }
          try {
            // Basic isolation - no DOM access, no network intentionally (fetch omitted)
            // eslint-disable-next-line no-new-func
            const fn = new Function(code)
            const result = fn()
            if (result !== undefined) {
              outputs.push({ type: "result", text: String(result) })
            }
            postMessage({ id, name, success: true, outputs })
          } catch (err) {
            outputs.push({ type: "error", text: String(err && err.message || err) })
            postMessage({ id, name, success: false, outputs })
          } finally {
            console.log = originalLog
          }
        }
      `
      const blob = new Blob([workerCode], { type: "application/javascript" })
      const worker = new Worker(URL.createObjectURL(blob))
      const runOne = (file: File) =>
        new Promise<void>(async (resolve) => {
          const code = await file.text()
          const id = crypto.randomUUID()
          const onMsg = (ev: MessageEvent) => {
            if (ev.data?.id === id) {
              const { name, success, outputs } = ev.data
              logs.push(`JS/TS: ${name} -> ${success ? "ok" : "error"}`)
              for (const o of outputs) {
                logs.push(`  [${o.type}] ${o.text}`)
              }
              worker.removeEventListener("message", onMsg)
              resolve()
            }
          }
          worker.addEventListener("message", onMsg)
          worker.postMessage({ id, name: file.name, code })
        })
      for (const f of jsTsFiles) {
        await runOne(f)
      }
      worker.terminate()
    }

    // Python via Pyodide
    async function runPy() {
      if (pyFiles.length === 0) return
      // Load Pyodide once
      // @ts-ignore
      if (!window.__pyodide) {
        // @ts-ignore
        window.loadPyodide =
          window.loadPyodide || (await import("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js")).loadPyodide
        // @ts-ignore
        window.__pyodide = await window.loadPyodide({ stderr: (s: string) => {}, stdout: (s: string) => {} })
      }
      // @ts-ignore
      const pyodide = window.__pyodide
      for (const f of pyFiles) {
        const code = await f.text()
        try {
          // capture output
          // @ts-ignore
          const out: string[] = []
          pyodide.setStdout({ batched: (s: string) => out.push(s) })
          pyodide.setStderr({ batched: (s: string) => out.push(s) })
          await pyodide.runPythonAsync(code)
          logs.push(`Python: ${f.name} -> ok`)
          for (const line of out) logs.push(`  [py] ${line}`)
        } catch (err: any) {
          logs.push(`Python: ${f.name} -> error`)
          logs.push(`  [error] ${err?.message || String(err)}`)
        }
      }
    }

    try {
      await runJsTs()
      await runPy()
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Execution completed.\n\n${logs.join("\n")}`,
        },
      ])
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Folder execution failed: ${err?.message || String(err)}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {messages.map((msg) => (
          <Card key={msg.id} className={msg.role === "user" ? "bg-background" : "bg-muted"}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <Badge variant={msg.role === "user" ? "default" : "secondary"}>{msg.role}</Badge>
                <div className="whitespace-pre-wrap text-pretty">{msg.content}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          placeholder="Ask me anything… e.g., Get the current API key for open-perplexity"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : "Send"}
        </Button>
        {/* Hidden folder picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          // @ts-ignore - vendor prefix support for directory selection
          webkitdirectory="true"
          directory="true"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              runFolder(e.target.files)
              e.currentTarget.value = ""
            }
          }}
        />
      </form>
    </div>
  )
}
