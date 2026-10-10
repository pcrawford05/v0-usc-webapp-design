import { NextRequest, NextResponse } from "next/server"

import { ask, type ChatTurn } from "@/lib/ai"

// Small per-instance limiter so a burst of traffic cannot exhaust the free-tier quota.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 12
const hits = new Map<string, number[]>()

function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 500) : ""
  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 })

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (limited(ip)) return NextResponse.json({ error: "Too many questions at once. Try again in a minute." }, { status: 429 })

  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: ChatTurn) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string")
        .map((t: ChatTurn) => ({ role: t.role, content: t.content.slice(0, 1500) }))
    : []

  try {
    return NextResponse.json(await ask(query, history))
  } catch (error) {
    console.error("[ask] failed", error)
    return NextResponse.json({ error: "Something went wrong answering that." }, { status: 500 })
  }
}
