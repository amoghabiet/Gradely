import { NextResponse } from "next/server"
import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supabase = getServerSupabase()
  const { user } = await getCurrentUserAndRole()
  if (!user) return NextResponse.json({ notifications: [] })
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ notifications: data })
}
