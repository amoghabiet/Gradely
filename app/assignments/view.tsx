import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"
import InstructorPanel from "@/components/assessments/instructor-panel"
import StudentPanel from "@/components/assessments/student-panel"
import { redirect } from "next/navigation"

export default async function AssignmentsView() {
  try {
    const { user, role } = await getCurrentUserAndRole()

    if (!user) {
      redirect("/auth/login")
    }

    const supabase = await getServerSupabase()
    const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false })

    if (error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800 font-semibold">Error loading assignments</p>
          <p className="text-red-700 text-sm mt-1">{error.message}</p>
        </div>
      )
    }

    if (role === "instructor" || role === "admin" || role === "ta") {
      return <InstructorPanel assignments={data || []} role={role!} />
    }

    return <StudentPanel assignments={data || []} />
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred"
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800 font-semibold">Error</p>
        <p className="text-red-700 text-sm mt-1">{message}</p>
      </div>
    )
  }
}
