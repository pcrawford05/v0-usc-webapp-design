// Merge research batches into data/programs.json, the app's single source of truth.
// Usage: node scripts/build-programs.mjs <dir-with-batch-json-files>
// Each batch file is a JSON array of program records (see lib/programs.ts for the schema).
import fs from "node:fs"
import path from "node:path"

const GROUPS = ["viterbi", "marshall", "iya", "joint", "oori", "keck", "health", "clubs", "across", "partners", "external"]
const CATEGORIES = [
  "Funding & Grants", "Competitions & Pitch", "Accelerators & Incubators", "Mentorship & Office Hours",
  "Events & Speakers", "Courses & Degrees", "Makerspaces & Coworking", "Legal & IP", "Research Commercialization",
  "Student Organizations", "Partners & Ecosystem", "Founder Toolkits",
]
const CADENCES = ["weekly", "monthly", "semester", "annual", "rolling", "ongoing", "one-time", "unknown"]
const AUDIENCES = ["undergrad", "grad", "phd", "postdoc", "faculty", "staff", "alumni", "community"]
const STAGES = ["idea", "prototype", "launched", "scaling"]

const dir = process.argv[2]
const outPath = path.join(process.cwd(), "data/programs.json")

const clean = v => (typeof v === "string" ? v.replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim() || null : null)
const slug = s => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
const pick = (arr, allowed) => (Array.isArray(arr) ? [...new Set(arr.map(x => String(x).toLowerCase().trim()))].filter(x => allowed.includes(x)) : [])

const problems = []
const seen = new Map()
for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
  const batch = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))
  for (const raw of batch) {
    const name = clean(raw.name)
    if (!name) continue
    const group = GROUPS.includes(raw.group) ? raw.group : (problems.push(`${file}: ${name} bad group ${raw.group}`), "across")
    const category = CATEGORIES.includes(raw.category)
      ? raw.category
      : (problems.push(`${file}: ${name} bad category ${raw.category}`), "Founder Toolkits")
    const rec = {
      id: "",
      name,
      aliases: Array.isArray(raw.aliases) ? raw.aliases.map(clean).filter(Boolean) : [],
      group,
      category,
      description: clean(raw.description),
      timing: /^(unknown|n\/a|none|null)\.?$/i.test(String(raw.timing ?? "").trim()) ? null : clean(raw.timing),
      cadence: CADENCES.includes(raw.cadence) ? raw.cadence : "unknown",
      months: Array.isArray(raw.months) ? [...new Set(raw.months.map(Number))].filter(m => m >= 1 && m <= 12).sort((a, b) => a - b) : [],
      eligibility: clean(raw.eligibility),
      audience: pick(raw.audience, AUDIENCES),
      stage: pick(raw.stage, STAGES),
      funding: clean(raw.funding),
      link: typeof raw.link === "string" && /^https?:\/\//.test(raw.link) ? raw.link.trim() : null,
      sources: Array.isArray(raw.sources) ? raw.sources.filter(s => typeof s === "string" && /^https?:\/\//.test(s)) : [],
      confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low",
      notes: clean(raw.notes),
    }
    const key = `${group}:${slug(name)}`
    if (seen.has(key)) {
      problems.push(`${file}: duplicate ${name} (kept first)`)
      continue
    }
    seen.set(key, rec)
  }
}

const ids = new Set()
const out = [...seen.values()]
  .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name))
  .map(p => {
    let id = slug(p.name)
    if (ids.has(id)) id = `${p.group}-${id}`
    ids.add(id)
    return { ...p, id }
  })

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n")
const byGroup = Object.fromEntries(GROUPS.map(g => [g, out.filter(p => p.group === g).length]))
console.log(`Wrote ${out.length} programs to ${outPath}`)
console.log(byGroup)
if (problems.length) console.log("Issues:\n  " + problems.join("\n  "))
