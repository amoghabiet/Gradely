"use client"
import { useState } from "react"

export default function InstructorPanel({ assignments, role }: { assignments: any[]; role: string }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [language, setLanguage] = useState("typescript")
  const [dueAt, setDueAt] = useState("")
  const [tests, setTests] = useState<Array<{ name: string; test_code: string }>>([
    {
      name: "Sample test",
      test_code: `function run({ userCode }) {\n  // Expect userCode.add(1,2) === 3\n  if (typeof userCode.add !== 'function') return { pass:false, message:'add() not found' }\n  return { pass: userCode.add(1,2) === 3, message: 'add should return 3 for 1+2' }\n}`,
    },
  ])
  const [rows, setRows] = useState(assignments || [])
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    const res = await fetch("/api/assessments/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, language, due_at: dueAt || null, tests }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) {
      setRows((r: any[]) => [data.assignment, ...r])
      setTitle("")
      setDescription("")
      setTests([{ name: "Sample test", test_code: tests[0]?.test_code || "" }])
    } else {
      alert(data.error || "Error creating assignment")
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Create Assignment</h2>
        <div className="grid gap-3 mt-4">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="rounded-md border px-3 py-2"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <select
              className="rounded-md border px-3 py-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option>typescript</option>
              <option>javascript</option>
            </select>
            <input
              className="rounded-md border px-3 py-2"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <div className="text-sm font-medium">Tests</div>
            {tests.map((t, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-3">
                <input
                  className="rounded-md border px-3 py-2"
                  placeholder="Test name"
                  value={t.name}
                  onChange={(e) => {
                    const v = [...tests]
                    v[i].name = e.target.value
                    setTests(v)
                  }}
                />
                <textarea
                  className="font-mono text-sm rounded-md border px-3 py-2"
                  rows={6}
                  placeholder="Test code"
                  value={t.test_code}
                  onChange={(e) => {
                    const v = [...tests]
                    v[i].test_code = e.target.value
                    setTests(v)
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-2"
                onClick={() =>
                  setTests([
                    ...tests,
                    { name: "New test", test_code: "function run({ userCode }) { return { pass:true } }" },
                  ])
                }
              >
                Add test
              </button>
              <button
                className="rounded-md border px-3 py-2"
                onClick={() => setTests((t) => t.slice(0, -1))}
                disabled={tests.length <= 1}
              >
                Remove last
              </button>
            </div>
          </div>
          <button
            className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
            onClick={create}
            disabled={busy || !title.trim()}
          >
            {busy ? "Creating..." : "Create Assignment"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Assignments</h2>
        <ul className="mt-3 grid gap-3">
          {rows.map((a: any) => (
            <li key={a.id} className="rounded-md border p-3">
              <div className="font-medium">{a.title}</div>
              <div className="text-sm opacity-70">{a.description}</div>
              <div className="text-xs mt-1">
                Language: {a.language} {a.due_at ? `• Due: ${new Date(a.due_at).toLocaleString()}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
