import { getServerSupabase, getCurrentUserAndRole } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { user, role } = await getCurrentUserAndRole()
    return NextResponse.json({ user, role })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json()

    if (action === "logout") {
      const supabase = await getServerSupabase()
      await supabase.auth.signOut()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
