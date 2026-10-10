import { GROUPS, MONTHS, programs, programById, type Program } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface AskResult {
  answer: string
  picks: { id: string; reason: string }[]
  provider: "gemini" | "groq" | "local"
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

function systemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return [
    "You are the USC Startup Atlas guide. You help USC students, researchers and alumni find the right entrepreneurship programs.",
    `Today is ${today}. Use this to say what is open now or coming up soon.`,
    "Answer ONLY from the program catalog provided. Never invent programs, dates, amounts or eligibility. If the catalog does not cover something, say so and suggest the closest options.",
    "Be concise and practical: 2 to 4 short sentences, then let the picks do the work. Do not use em dashes. Do not end with a question.",
    'Respond as JSON: {"answer": string, "picks": [{"id": string, "reason": string}]} with 3 to 6 picks ordered by relevance. Each reason is one short sentence tailored to the user. Use ids exactly as written in the catalog.',
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
    return { answer: obj.answer.replace(/\s*—\s*/g, ", "), picks }
  } catch {
    return null
  }
}

export async function ask(query: string, history: ChatTurn[] = []): Promise<AskResult> {
  const context = [...history.filter(t => t.role === "user").slice(-2).map(t => t.content), query].join(" ")
  const ranked = rankPrograms(context, 20).map(r => r.program)
  const system = systemPrompt()
  const trimmedHistory = history.slice(-6)

  const providers: [AskResult["provider"], typeof callGemini][] = [["gemini", callGemini], ["groq", callGroq]]
  for (const [name, call] of providers) {
    try {
      const parsed = parse(await call(system, trimmedHistory, query, ranked))
      if (parsed) return { ...parsed, provider: name }
    } catch (err) {
      console.warn(`[ask] ${name} unavailable:`, err instanceof Error ? err.message : err)
    }
  }

  // No model reachable: still useful, return the best keyword matches.
  return {
    answer: ranked.length
      ? "Here are the closest matches in the catalog. Tap any program for timing, eligibility and the official link."
      : "I could not find a close match. Try describing what you need, for example funding, mentorship or a pitch competition.",
    picks: ranked.slice(0, 6).map(p => ({ id: p.id, reason: p.description ?? "" })),
    provider: "local",
  }
}
