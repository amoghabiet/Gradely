import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supabase = getServerSupabase()
  const { data, error } = await supabase.from("assignment_stats").select("*")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ stats: data })
}
