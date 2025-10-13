// Run from v0 scripts runner. Uses fetch; prints results for quick verification.

const sampleTS = `
function sum(a: number, b: number){
return a+b
}
`

async function main() {
  const base = (globalThis as any).location?.origin || "http://localhost:3000"

  async function call(path: string, body: any) {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    console.log("[v0] call", path, res.status, json)
    return { status: res.status, json }
  }

  // Review API
  await call("/api/review", { code: sampleTS, language: "typescript" })

  // Assistant API
  await call("/api/assistant", {
    prompt: "Suggest a better name for 'sum' and show the edit.",
    code: sampleTS,
    language: "typescript",
  })
}

main().catch((e) => console.error("[v0] e2e failed", e))
