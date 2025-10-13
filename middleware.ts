import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(_req: NextRequest) {
  // For SSR token refresh, Next.js environment handles ssr client cookies; keep middleware minimal
  return NextResponse.next()
}

export const config = {
  matcher: ["/assignments/:path*", "/api/assessments/:path*"],
}
