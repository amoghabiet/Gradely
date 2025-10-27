import { getServerSupabase } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 })
    }

    const supabase = await getServerSupabase()

    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role }])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Set role error:", error)
    return NextResponse.json({ error: "Failed to set user role" }, { status: 500 })
  }
}
