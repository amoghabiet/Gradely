import { NextResponse } from "next/server"
import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"
import vm from "node:vm"

type GradeResult = {
  score: number
  results: Array<{ test_id: string; pass: boolean; message?: string }>
  feedback?: any
}

function runTestInSandbox(userCode: string, testCode: string): { pass: boolean; message?: string } {
  // Extremely constrained sandbox; MVP only; do not allow network or fs
  const sandbox: any = { module: {}, exports: {}, console: { log() {} } }
  vm.createContext(sandbox)
  const codeWrapped = `
    "use strict";
    ${userCode}
    const userCode = (typeof module !== 'undefined' && module.exports) ? module.exports : exports;
  `
  const testWrapped = `
    "use strict";
    ${testCode}
    const result = await (typeof run === 'function' ? run({ userCode: userCode }) : { pass: false, message: "No run() defined" });
    result;
  `
  try {
    new vm.Script(codeWrapped, { timeout: 1000 }).runInContext(sandbox, { timeout: 1000 })
    // Support async test via top-level await in a separate context is not possible.
    // Use a function wrapper to simulate async tests.
    const asyncRunner = new vm.Script(
      `
      (async () => {
        ${testWrapped}
      })()
    `,
      { timeout: 1000 },
    )
    const result = asyncRunner.runInContext(sandbox, { timeout: 2000 })
    // Not perfect in node vm; treat as sync best-effort
    // If a promise, resolve is not supported here. For MVP, require sync tests.
    if (typeof result === "object" && result && "then" in (result as any)) {
      return { pass: false, message: "Async tests not supported in MVP" }
    }
    return (result as any) ?? { pass: false, message: "No result" }
  } catch (e: any) {
    return { pass: false, message: e?.message || "Execution error" }
  }
}

async function gradeSubmission(supabase: any, assignment_id: string, userCode: string): Promise<GradeResult> {
  const { data: tests } = await supabase.from("assignment_tests").select("*").eq("assignment_id", assignment_id)
  if (!tests?.length) return { score: 0, results: [], feedback: { note: "No tests defined" } }
  const results = tests.map((t: any) => {
    const out = runTestInSandbox(userCode, t.test_code)
    return { test_id: t.id, pass: !!out.pass, message: out.message }
  })
  const passCount = results.filter((r) => r.pass).length
  const score = Math.round((passCount / tests.length) * 10000) / 100
  return { score, results, feedback: { summary: `Passed ${passCount}/${tests.length}` } }
}

export async function POST(req: Request) {
  const supabase = getServerSupabase()
  const { user } = await getCurrentUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { assignment_id, code, language = "typescript" } = await req.json()
  // Upsert submission
  const { data: sub, error: upErr } = await supabase
    .from("assignment_submissions")
    .upsert(
      { assignment_id, user_id: user.id, code, language, status: "pending" },
      { onConflict: "assignment_id,user_id" },
    )
    .select("*")
    .single()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const grade = await gradeSubmission(supabase, assignment_id, code)

  const { error: updErr } = await supabase
    .from("assignment_submissions")
    .update({ status: "graded", score: grade.score, feedback: grade.feedback, updated_at: new Date().toISOString() })
    .eq("id", sub.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // Store per-test results
  if (grade.results.length) {
    const rows = grade.results.map((r) => ({
      submission_id: sub.id,
      test_id: r.test_id,
      pass: r.pass,
      message: r.message,
    }))
    await supabase.from("submission_results").insert(rows)
  }

  // Notify student
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "graded",
    payload: { assignment_id, score: grade.score },
  })

  return NextResponse.json({
    submission_id: sub.id,
    score: grade.score,
    results: grade.results,
    feedback: grade.feedback,
  })
}
