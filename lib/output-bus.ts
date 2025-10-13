// Provides Output.info/success/warning/error/ai helpers

type OutputKind = "info" | "success" | "warning" | "error" | "ai"

export type OutputEntry = {
  id: string
  kind: OutputKind
  text: string
  codeSnippet?: string
  filePath?: string
  line?: number
  meta?: Record<string, unknown>
  timestamp?: number
}

type OutputEvents =
  | { type: "append"; payload: OutputEntry }
  | { type: "clear" }
  | { type: "focus" }
  | { type: "toggle-expand" }
  | { type: "toggle-hidden" }

class OutputBus {
  private target = new EventTarget()
  private static _instance: OutputBus | null = null
  static get instance() {
    if (!this._instance) this._instance = new OutputBus()
    return this._instance
  }

  on(handler: (e: OutputEvents) => void) {
    const listener = (ev: Event) => {
      // @ts-expect-error custom detail
      handler(ev.detail as OutputEvents)
    }
    this.target.addEventListener("output", listener as EventListener)
    return () => this.target.removeEventListener("output", listener as EventListener)
  }

  emit(event: OutputEvents) {
    const custom = new CustomEvent("output", { detail: event })
    this.target.dispatchEvent(custom)
  }

  append(entry: Omit<OutputEntry, "id" | "timestamp">) {
    this.emit({
      type: "append",
      payload: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        ...entry,
      },
    })
  }
  clear() {
    this.emit({ type: "clear" })
  }
  focus() {
    this.emit({ type: "focus" })
  }
  toggleExpand() {
    this.emit({ type: "toggle-expand" })
  }
  toggleHidden() {
    this.emit({ type: "toggle-hidden" })
  }
}

export const outputBus = OutputBus.instance

export const Output = {
  info: (text: string, opts: Partial<OutputEntry> = {}) => outputBus.append({ kind: "info", text, ...opts }),
  success: (text: string, opts: Partial<OutputEntry> = {}) => outputBus.append({ kind: "success", text, ...opts }),
  warning: (text: string, opts: Partial<OutputEntry> = {}) => outputBus.append({ kind: "warning", text, ...opts }),
  error: (text: string, opts: Partial<OutputEntry> = {}) => outputBus.append({ kind: "error", text, ...opts }),
  ai: (text: string, opts: Partial<OutputEntry> = {}) => outputBus.append({ kind: "ai", text, ...opts }),
}
