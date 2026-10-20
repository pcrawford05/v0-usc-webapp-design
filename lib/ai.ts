import { GROUPS, MONTHS, programs, programById, type Program } from "@/lib/programs"
import { COLUMN, forward, networkPrompt, onMap } from "@/lib/network"
import { rankPrograms } from "@/lib/search"

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface AskResult {
  answer: string
  picks: { id: string; reason: string }[]
  /** An ordered route drawn on the subway map: what to do now, next, and later. */
  plan?: RoutePlan
  provider: "gemini" | "groq" | "local"
  /** Why each AI provider was skipped, when falling back. Never contains keys. */
  fallbackReason?: string
}

export interface RoutePlan {
  now: string[]
  next: string[]
  later: string[]
  /** Always-on support (mentoring, office hours, spaces, legal help) to lean on throughout. */
  support: string[]
}

// ---------- Prompt ----------

function compactLine(p: Program): string {
  const when = p.months.length ? p.months.map(m => MONTHS[m - 1]).join("/") : p.cadence
  return `${p.id} | ${p.name} | ${GROUPS[p.group].short} | ${p.category} | ${when}`
}

function detail(p: Program): string {
  return JSON.stringify({
    id: p.id, name: p.name, group: GROUPS[p.group].label, category: p.category, description: p.description,
    timing: p.timing, eligibility: p.eligibility, funding: p.funding, audience: p.audience, stage: p.stage, link: p.link,
  })
}

function systemPrompt(profile?: string): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return [
    "You are the Founder Compass guide. You help USC students, researchers and alumni find the right entrepreneurship programs.",
    `Today is ${today}. Use this to say what is open now or coming up soon.`,
    "Answer ONLY from the program catalog provided. Never invent programs, dates, amounts or eligibility. If the catalog does not cover something, say so and suggest the closest options.",
    "Be concise and practical: 2 to 4 short sentences, then let the picks do the work. Start with the substance; no greetings or introductions. Do not use em dashes. Do not end with a question.",
    ...(profile ? [`About this user: ${profile}. Favor programs they are eligible for and that fit their stage, and mention why when it matters.`] : []),
    'Respond as JSON: {"answer": string, "picks": [{"id": string, "reason": string}], "plan": {"now": [id], "next": [id], "later": [id], "support": [id]}} with 3 to 6 picks ordered by relevance. Each reason is one short sentence tailored to the user. Use ids exactly as written in the catalog.',
    "The plan is a route on the USC startup subway map below. Lines are founder goals and a station on two lines is an interchange. Choose 4 to 6 stations in total: 1 to 2 for now, 1 to 2 for next, 1 to 2 for later. Cover every goal the user mentions (for example a co-founder means a Find your team station). Order them so the user moves forward through the stages in brackets, prefer stations on the map, and use interchanges to switch lines when the goals span lines. Put always-on help such as mentorship, office hours, makerspaces and legal clinics in support (0 to 3 ids), not in the route. Every pick should appear in the plan.",
    "SUBWAY MAP:",
    networkPrompt(),
  ].join("\n")
}

function userPrompt(query: string, ranked: Program[], withCatalog: boolean): string {
  return [
    ...(withCatalog ? ["FULL CATALOG (id | name | group | category | when):", programs.map(compactLine).join("\n"), ""] : []),
    "DETAILS FOR THE MOST RELEVANT PROGRAMS:",
    ranked.map(detail).join("\n"),
    "",
    `USER QUESTION: ${query}`,
  ].join("\n")
}

// ---------- Providers (all free tier) ----------

// Gemini free tier is generous on tokens, so it gets the whole catalog plus details (~10k tokens).
async function callGemini(system: string, history: ChatTurn[], query: string, ranked: Program[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY not set")
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest"
  const prompt = userPrompt(query, ranked, true)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        ...history.map(t => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
        { role: "user", parts: [{ text: prompt }] },
      ],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
}

// Groq's free tier caps tokens per minute, so it only gets the top matches (~4k tokens).
async function callGroq(system: string, history: ChatTurn[], query: string, ranked: Program[]): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY not set")
  const prompt = userPrompt(query, ranked.slice(0, 15), false)
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ""
}

function parse(raw: string): Omit<AskResult, "provider"> | null {
  try {
    const obj = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim())
    const picks = Array.isArray(obj.picks)
      ? obj.picks.filter((p: { id?: string }) => p && typeof p.id === "string" && programById.has(p.id)).slice(0, 6)
      : []
    if (typeof obj.answer !== "string") return null
    const ids = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && programById.has(x)).slice(0, n) : [])
    const plan = obj.plan && typeof obj.plan === "object"
      ? { ...forward({ now: ids(obj.plan.now, 3), next: ids(obj.plan.next, 3), later: ids(obj.plan.later, 3) }), support: ids(obj.plan.support, 4) }
      : undefined
    return { answer: obj.answer.replace(/\s*—\s*/g, ", "), picks, plan: plan && plan.now.length + plan.next.length + plan.later.length ? plan : fallbackPlan(picks.map((p: { id: string }) => p.id)) }
  } catch {
    return null
  }
}

/** Without a model-written plan, order the picks along the map: earliest stations first. */
function fallbackPlan(ids: string[]): RoutePlan | undefined {
  const route = ids.filter(onMap).sort((a, b) => COLUMN[a] - COLUMN[b])
  if (!route.length) return undefined
  const third = Math.max(1, Math.ceil(route.length / 3))
  return { now: route.slice(0, third), next: route.slice(third, third * 2), later: route.slice(third * 2), support: ids.filter(id => !onMap(id)).slice(0, 3) }
}

export async function ask(query: string, history: ChatTurn[] = [], profile?: string): Promise<AskResult> {
  const context = [...history.filter(t => t.role === "user").slice(-2).map(t => t.content), query].join(" ")
  const ranked = rankPrograms(context, 20).map(r => r.program)
  const system = systemPrompt(profile)
  const trimmedHistory = history.slice(-6)

  const providers: [AskResult["provider"], typeof callGemini][] = [["gemini", callGemini], ["groq", callGroq]]
  const reasons: string[] = []
  for (const [name, call] of providers) {
    try {
      const parsed = parse(await call(system, trimmedHistory, query, ranked))
      if (parsed) return { ...parsed, provider: name }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reasons.push(`${name}: ${msg.slice(0, 160)}`)
      console.warn(`[ask] ${name} unavailable:`, msg)
    }
  }

  // No model reachable: still useful, return the best keyword matches.
  return {
    answer: ranked.length
      ? "Here are the closest matches in the catalog. Tap any program for timing, eligibility and the official link."
      : "I could not find a close match. Try describing what you need, for example funding, mentorship or a pitch competition.",
    picks: ranked.slice(0, 6).map(p => ({ id: p.id, reason: p.description ?? "" })),
    plan: fallbackPlan(rankPrograms(context, 40).map(r => r.program.id).filter(onMap).slice(0, 5)),
    provider: "local",
    fallbackReason: reasons.join(" | ") || undefined,
  }
}
