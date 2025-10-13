import { NextResponse } from "next/server"
import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"

export async function PATCH(req: Request) {
  const supabase = getServerSupabase()
  const { role } = await getCurrentUserAndRole()
  if (!role || !["ta", "instructor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { submission_id, score, feedback } = await req.json()
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      score,
      feedback,
      status: "graded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submission_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
