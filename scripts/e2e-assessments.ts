// Run within v0 scripts runner.
const base = (globalThis as any).origin || ""

async function post(path: string, body: any) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `POST ${path} failed`)
  return j
}
async function get(path: string) {
  const r = await fetch(`${base}${path}`)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `GET ${path} failed`)
  return j
}

async function main() {
  console.log("[v0] Starting E2E assessments…")
  // NOTE: This script assumes an authenticated session for an instructor in the preview.
  // Step 1: Create assignment with one simple test
  const created = await post("/api/assessments/assignments", {
    title: "Add Function",
    description: "Implement add(a,b)",
    language: "javascript",
    tests: [
      {
        name: "adds 1+2",
        test_code: `function run({ userCode }) { return { pass: userCode.add?.(1,2) === 3, message: "add(1,2) should equal 3" } }`,
      },
    ],
  })
  console.log("[v0] Created assignment:", created.assignment?.id)

  // Step 2: As a student, submit code (requires a student session)
  // For demonstration in v0, we call the same endpoint; actual role separation occurs via RLS and session.
  const sub = await post("/api/assessments/submissions", {
    assignment_id: created.assignment.id,
    code: `module.exports = { add: (a,b)=>a+b }`,
    language: "javascript",
  })
  console.log("[v0] Submission graded: score", sub.score)

  // Step 3: Analytics
  const stats = await get("/api/assessments/analytics")
  console.log("[v0] Analytics:", stats)

  // Step 4: Notifications for current user
  const notes = await get("/api/assessments/notifications")
  console.log("[v0] Notifications:", notes)
}

main().catch((e) => console.log("[v0] E2E error:", e.message))
