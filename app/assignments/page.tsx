import { Suspense } from "react"
import AssignmentsView from "./view"

export default function Page() {
  return (
    <main className="container mx-auto p-6">
      <Suspense fallback={<div>Loading assignments…</div>}>
        <AssignmentsView />
      </Suspense>
    </main>
  )
}
