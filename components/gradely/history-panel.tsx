"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type Snapshot = {
  id: string
  language: "typescript" | "javascript" | "python" | "java"
  code: string
  createdAt: number
}

export function HistoryPanel(props: {
  storageKey: string
  onLoad?: (snap: Snapshot) => void
}) {
  const [snaps, setSnaps] = useState<Snapshot[]>([])

  const load = () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(props.storageKey)
    const list: Snapshot[] = raw ? JSON.parse(raw) : []
    setSnaps(list)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Snapshots</h2>
        <Button size="sm" variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {snaps.map((s) => (
          <div key={s.id} className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
            <div className="mt-1 text-sm">{s.language.toUpperCase()}</div>
            <div className="mt-2 line-clamp-3 text-xs text-muted-foreground">{s.code}</div>
            <div className="mt-3 flex items-center justify-end">
              <Button size="sm" variant="secondary" onClick={() => props.onLoad?.(s)}>
                Load
              </Button>
            </div>
          </div>
        ))}
        {snaps.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No snapshots yet. Click "Save Snapshot" to store your current code.
          </div>
        )}
      </div>
    </Card>
  )
}
