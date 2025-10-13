import { getCurrentUserAndRole, getServerSupabase } from "@/lib/supabase/server"
import InstructorPanel from "@/components/assessments/instructor-panel"
import StudentPanel from "@/components/assessments/student-panel"

export default async function AssignmentsView() {
  const supabase = getServerSupabase()
  const { user, role } = await getCurrentUserAndRole()
  const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false })
  if (error) return <div>Error: {error.message}</div>
  if (!user) return <div>Please sign in to view assignments.</div>
  if (role === "instructor" || role === "admin" || role === "ta") {
    return <InstructorPanel assignments={data || []} role={role!} />
  }
  return <StudentPanel assignments={data || []} />
}
