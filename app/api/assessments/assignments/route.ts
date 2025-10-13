import { NextResponse } from "next/server"
import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supabase = getServerSupabase()
  const { user, role } = await getCurrentUserAndRole()
  // Anyone can read assignments
  const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ assignments: data, role })
}

export async function POST(req: Request) {
  const supabase = getServerSupabase()
  const { user, role } = await getCurrentUserAndRole()
  if (!user || !role || !["instructor", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const { title, description, language = "typescript", due_at, tests } = body
  const { data: a, error } = await supabase
    .from("assignments")
    .insert({ title, description, language, due_at, created_by: user.id })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (Array.isArray(tests) && tests.length) {
    const rows = tests.map((t: any) => ({ assignment_id: a.id, name: t.name, test_code: t.test_code }))
    const { error: tErr } = await supabase.from("assignment_tests").insert(rows)
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 })
  }
  return NextResponse.json({ assignment: a })
}
