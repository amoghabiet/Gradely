"use client"
import { useState } from "react"

export default function StudentPanel({ assignments }: { assignments: any[] }) {
  const [selected, setSelected] = useState<any>(assignments[0] || null)
  const [code, setCode] = useState<string>(`// Provide an implementation\nmodule.exports = { add: (a,b)=>a+b }\n`)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    const res = await fetch("/api/assessments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: selected.id, code, language: selected.language }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) setResult(data)
    else alert(data.error || "Submission error")
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Assignments</h2>
        <select
          className="mt-3 rounded-md border px-3 py-2"
          value={selected?.id || ""}
          onChange={(e) => {
            const a = assignments.find((x: any) => x.id === e.target.value)
            setSelected(a || null)
          }}
        >
          {assignments.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <p className="text-sm mt-2 opacity-80">{selected?.description}</p>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold">Your Code</h3>
        <textarea
          className="mt-2 w-full rounded-md border px-3 py-2 font-mono text-sm"
          rows={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="mt-3">
          <button
            className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
            onClick={submit}
            disabled={!selected || busy}
          >
            {busy ? "Submitting…" : "Submit & Auto-Grade"}
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold">Results</div>
          <div className="text-sm mt-1">Score: {result.score}</div>
          <ul className="mt-2 text-sm list-disc pl-5">
            {result.results?.map((r: any, i: number) => (
              <li key={i} className={r.pass ? "text-green-600" : "text-red-600"}>
                {r.pass ? "Pass" : "Fail"} - {r.message || "No message"}
              </li>
            ))}
          </ul>
          <pre className="text-xs mt-2 bg-gray-50 p-2 rounded">{JSON.stringify(result.feedback, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
