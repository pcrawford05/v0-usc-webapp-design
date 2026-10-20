import { CATEGORIES, GROUP_KEYS, isAlwaysOn, type Audience, type Category, type GroupKey, type Program, type Stage } from "@/lib/programs"

// Browse filters live in the URL so any filtered view can be shared or bookmarked.

export type SortKey = "best" | "soon" | "az"

export interface Filters {
  q: string
  type: Category | null
  who: Audience | null
  stage: Stage | null
  units: GroupKey[]
  open: boolean
  verified: boolean
  sort: SortKey
}

// Short, readable slugs so shared links stay textable: ?t=funding&u=viterbi
const TYPE_SLUGS: Record<Category, string> = {
  "Funding & Grants": "funding",
  "Competitions & Pitch": "pitch",
  "Accelerators & Incubators": "accelerators",
  "Mentorship & Office Hours": "mentorship",
  "Events & Speakers": "events",
  "Courses & Degrees": "courses",
  "Makerspaces & Coworking": "spaces",
  "Legal & IP": "legal",
  "Research Commercialization": "research",
  "Student Organizations": "clubs",
  "Partners & Ecosystem": "partners",
  "Founder Toolkits": "toolkits",
}
const typeFromSlug = (s: string | null) => (CATEGORIES.find(c => TYPE_SLUGS[c] === s || c === s) ?? null) as Category | null

export function readFilters(params: URLSearchParams): Filters {
  // Short keys first; the long ones still work for links shared before the rename.
  const get = (short: string, long: string) => params.get(short) ?? params.get(long)
  return {
    q: params.get("q") ?? "",
    type: typeFromSlug(get("t", "type")),
    who: (get("for", "who") as Audience) || null,
    stage: (get("s", "stage") as Stage) || null,
    units: (get("u", "unit") ?? "").split(",").filter((g): g is GroupKey => GROUP_KEYS.includes(g as GroupKey)),
    open: params.get("open") === "1",
    verified: (get("v", "verified")) === "1",
    sort: (["soon", "az"].includes(params.get("sort") ?? "") ? params.get("sort") : "best") as SortKey,
  }
}

/** URL param changes for a partial filter update; null removes the param. */
export function filterParams(f: Partial<Filters>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if ("q" in f) out.q = f.q || null
  if ("type" in f) Object.assign(out, { t: f.type ? TYPE_SLUGS[f.type] : null, type: null })
  if ("who" in f) Object.assign(out, { for: f.who ?? null, who: null })
  if ("stage" in f) Object.assign(out, { s: f.stage ?? null, stage: null })
  if ("units" in f) Object.assign(out, { u: f.units?.length ? f.units.join(",") : null, unit: null })
  if ("open" in f) out.open = f.open ? "1" : null
  if ("verified" in f) Object.assign(out, { v: f.verified ? "1" : null, verified: null })
  if ("sort" in f) out.sort = f.sort === "best" ? null : f.sort ?? null
  return out
}

export const CLEAR_ALL: Partial<Filters> = { q: "", type: null, who: null, stage: null, units: [], open: false, verified: false }

/** Months until the program next runs: 0 this month, 1 next month... Infinity if undated. */
export function monthsAway(p: Program, now = new Date()): number {
  if (!p.months.length) return Infinity
  const m = now.getMonth() + 1
  return Math.min(...p.months.map(x => (x - m + 12) % 12))
}

/** Running now or within the next month, counting year-round programs. */
export function isOpenNow(p: Program): boolean {
  return isAlwaysOn(p) || monthsAway(p) <= 1
}

type Key = "type" | "who" | "stage" | "units" | "open" | "verified"

/** Every filter except `skip`, so facet counts show what each option would return. */
export function applyFilters(items: Program[], f: Filters, skip?: Key): Program[] {
  return items.filter(
    p =>
      (skip === "type" || !f.type || p.category === f.type) &&
      (skip === "who" || !f.who || p.audience.includes(f.who)) &&
      (skip === "stage" || !f.stage || p.stage.includes(f.stage)) &&
      (skip === "units" || !f.units.length || f.units.includes(p.group)) &&
      (skip === "open" || !f.open || isOpenNow(p)) &&
      (skip === "verified" || !f.verified || p.confidence !== "low"),
  )
}
