import { GROUPS, programs, type Program } from "@/lib/programs"

// ---------- Retrieval: BM25 over every program field, with founder-speak synonyms ----------

const SYNONYMS: Record<string, string[]> = {
  money: ["funding", "grant", "fund", "prize", "award"],
  cash: ["funding", "grant", "prize"],
  funding: ["grant", "fund", "prize", "award", "investment"],
  invest: ["venture", "fund", "angel", "investment"],
  pitch: ["competition", "showcase", "demo"],
  compete: ["competition", "challenge", "prize"],
  mentor: ["mentorship", "office", "hours", "advisor", "residence"],
  advice: ["mentorship", "office", "hours"],
  lawyer: ["legal", "law", "clinic", "ip", "patent"],
  patent: ["ip", "intellectual", "property", "legal"],
  cofounder: ["co-founder", "matching", "speed", "dating", "mixer"],
  network: ["mixer", "happy", "hour", "networking", "community"],
  space: ["coworking", "makerspace", "lab"],
  build: ["makerspace", "prototype", "hackathon"],
  biotech: ["biomedical", "health", "medical", "life", "sciences", "therapeutics"],
  medical: ["biomedical", "health", "fda", "clinical"],
  class: ["course", "minor", "degree", "certificate"],
  learn: ["course", "bootcamp", "training", "workshop"],
  visa: ["international"],
  international: ["visa", "immigration"],
  club: ["student", "organization"],
}

const STOP = new Set("a an and are as at be by can do for from get how i in is it me my of on or the to what where which who with you your".split(" "))
const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9$ ]+/g, " ").split(/\s+/).filter(t => t.length > 1 && !STOP.has(t))

function docText(p: Program): string {
  return [
    p.name, p.name, p.aliases.join(" "), GROUPS[p.group].label, p.category, p.description, p.eligibility,
    p.timing, p.funding, p.audience.join(" "), p.stage.join(" "), p.cadence,
  ].filter(Boolean).join(" ")
}

const docs = programs.map(p => tokenize(docText(p)))
const avgLen = docs.reduce((n, d) => n + d.length, 0) / Math.max(docs.length, 1)
const df = new Map<string, number>()
docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) ?? 0) + 1)))

export function rankPrograms(query: string, limit = 20): { program: Program; score: number }[] {
  const base = tokenize(query)
  const terms = [...new Set(base.flatMap(t => [t, ...(SYNONYMS[t] ?? [])]))]
  const N = docs.length
  const scored = docs.map((d, i) => {
    let score = 0
    for (const t of terms) {
      const tf = d.filter(x => x === t || (t.length > 4 && x.startsWith(t))).length
      if (!tf) continue
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5))
      score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / avgLen)))
    }
    return { program: programs[i], score }
  })
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
}
