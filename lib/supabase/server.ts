import { cookies, headers } from "next/headers"
import { createServerClient } from "@supabase/ssr"

let client: ReturnType<typeof createServerClient> | null = null

export async function getServerSupabase() {
  const c = await cookies()
  const h = await headers()
  if (client) return client
  client = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      get: (name: string) => c.get(name)?.value,
      set: (name: string, value: string, options: any) => c.set({ name, value, ...options }),
      remove: (name: string, options: any) => c.set({ name, value: "", ...options }),
    },
    headers: {
      get: (key: string) => h.get(key),
    } as any,
  })
  return client
}

export async function getCurrentUserAndRole() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null as any, role: null as any }
  const { data: roleRow } = await supabase.from("user_roles").select("*").eq("user_id", user.id).maybeSingle()
  return { user, role: roleRow?.role ?? null }
}
