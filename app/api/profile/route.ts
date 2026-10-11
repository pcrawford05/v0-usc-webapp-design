import { NextRequest, NextResponse } from "next/server"

import { INTERESTS, ROLES, SCHOOLS, STAGES, type Profile } from "@/lib/profile"

// Turns a LinkedIn "Save to PDF" export or pasted profile text into a founder profile.
// The document is sent to Gemini once and never stored.

const MAX_PDF_BYTES = 3_000_000
const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined)

const INSTRUCTIONS = `You read a person's LinkedIn profile and fill in a USC founder profile. Return JSON only:
{"name": string|null, "role": ${ROLES.map(r => `"${r.key}"`).join("|")}|null, "school": ${SCHOOLS.map(s => `"${s.key}"`).join("|")}|null,
 "stage": ${STAGES.map(s => `"${s.key}"`).join("|")}|null, "interests": [${INTERESTS.map(i => `"${i.key}"`).join("|")}], "venture": string|null}
Rules: role reflects their CURRENT USC status (undergrad, grad = master's or MBA, phd = PhD or postdoc, faculty = faculty or staff, alumni = graduated).
school: viterbi for engineering or computer science, marshall for business, iya for the Iovine and Young Academy, keck for medicine or health sciences, other for any other USC school, null if not at USC.
stage: only if they are clearly building a venture. interests: up to 3 that fit their situation. venture: one sentence on what they are building, or null.
Use null when the profile does not say. Do not invent details.`

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "Profile import needs the AI to be configured." }, { status: 503 })

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 20_000) : ""
  const pdf = typeof body?.pdf === "string" ? body.pdf : ""
  if (!text && !pdf) return NextResponse.json({ error: "Upload your LinkedIn PDF or paste your profile text." }, { status: 400 })
  if (pdf && (pdf.length * 3) / 4 > MAX_PDF_BYTES) return NextResponse.json({ error: "That PDF is too large (3 MB max)." }, { status: 413 })

  const parts = pdf ? [{ inline_data: { mime_type: "application/pdf", data: pdf } }, { text: "Fill in the profile from this document." }] : [{ text }]
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest"
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const json = await res.json()
    const raw = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}")
    const profile: Profile = {
      name: typeof raw.name === "string" ? raw.name.slice(0, 80) : undefined,
      role: pick(raw.role, ROLES.map(r => r.key)),
      school: pick(raw.school, SCHOOLS.map(s => s.key)),
      stage: pick(raw.stage, STAGES.map(s => s.key)),
      interests: Array.isArray(raw.interests)
        ? raw.interests.filter((i: unknown) => INTERESTS.some(x => x.key === i)).slice(0, 3)
        : [],
      venture: typeof raw.venture === "string" ? raw.venture.replace(/\s*—\s*/g, ", ").slice(0, 240) : undefined,
    }
    return NextResponse.json({ profile })
  } catch (err) {
    console.error("[profile] import failed", err)
    return NextResponse.json({ error: "Could not read that profile. Try pasting the text instead." }, { status: 502 })
  }
}
