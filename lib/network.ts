import { MONTHS, programById, programs, type Program, type Stage } from "@/lib/programs"

// The subway is a curated map of flagship programs. Lines are founder goals; a program on
// two lines is an interchange. Everything else (courses, clubs, always-on services, partners)
// is presented differently, because it is not a stop you "arrive" at.

export type Kind = "program" | "service" | "course" | "community" | "partner"

const SERVICE_CATEGORIES = new Set(["Mentorship & Office Hours", "Makerspaces & Coworking", "Legal & IP", "Founder Toolkits"])

/** What sort of thing a catalog entry is, which decides how the UI presents it. */
export function kindOf(p: Program): Kind {
  if (p.category === "Courses & Degrees") return "course"
  if (p.category === "Student Organizations") return "community"
  if (p.category === "Partners & Ecosystem") return "partner"
  if (SERVICE_CATEGORIES.has(p.category)) return "service"
  if (!p.months.length && ["ongoing", "weekly", "monthly"].includes(p.cadence) && p.category === "Events & Speakers") return "service"
  return "program"
}

export const KIND_LABELS: Record<Kind, string> = {
  program: "Programs with a cycle",
  service: "Always-on support",
  course: "Courses & degrees",
  community: "Student clubs",
  partner: "Partners",
}

export interface Line {
  key: string
  name: string
  color: string
  stops: string[]
}

export const LINES: Line[] = [
  { key: "team", name: "Find your team", color: "#C98A00", stops: ["all-school-startup-mixers", "co-founder-speed-dating", "origin-weekend", "usc-and-techstars-startup-weekend", "deeptech-founder-matching", "usc-alumni-entrepreneurs-network-aen"] },
  { key: "pitch", name: "Pitch & win", color: "#C2410C", stops: ["origin-weekend", "trojan-tank", "min-family-challenge", "new-venture-seed-competition", "maseeh-entrepreneurship-prize-competition", "iya-venture-showcase", "usc-viterbi-startup-showcase"] },
  { key: "funding", name: "Get funded", color: "#1B7F5C", stops: ["catalyst-microgrant-fund", "iya-ignite-grants", "ship-fund", "venturewell-e-team-program", "new-venture-seed-competition", "viterbi-venture-fund", "usc-marshall-venture-fund", "tech-coast-angels"] },
  { key: "build", name: "Build & accelerate", color: "#990000", stops: ["summer-start-fellows", "summer-smasher", "iya-innovation-quest", "usc-and-techstars-university-catalyst", "viterbi-startup-garage", "marshall-greif-incubator", "usc-marshall-venture-fund", "y-combinator"] },
  { key: "research", name: "Lab to market", color: "#2563A8", stops: ["from-lab-to-startup", "nsf-i-corps-hub-west-region", "national-i-corps-teams-grant", "stevens-translation-catalyst", "venturewell-e-team-program", "innovation-catalyst-program-icp", "icp-startup-launch", "alfred-e-mann-institute-fund-ami"] },
  { key: "health", name: "Health & bio", color: "#BE185D", stops: ["spark-at-usc", "sc-ctsi-southern-california-clinical-and-translational-scien", "innovation-catalyst-program-icp", "california-life-sciences-fast-program", "alfred-e-mann-institute-fund-ami"] },
]

// Column = how far along a founder usually is. Shared stations sit in one column on every line.
export const COLUMN: Record<string, number> = {
  "all-school-startup-mixers": 0, "from-lab-to-startup": 0,
  "co-founder-speed-dating": 1, "catalyst-microgrant-fund": 1, "nsf-i-corps-hub-west-region": 1, "summer-start-fellows": 1,
  "origin-weekend": 2, "iya-ignite-grants": 2, "national-i-corps-teams-grant": 2, "spark-at-usc": 2, "summer-smasher": 2,
  "trojan-tank": 3, "ship-fund": 3, "stevens-translation-catalyst": 3, "sc-ctsi-southern-california-clinical-and-translational-scien": 3, "iya-innovation-quest": 3, "usc-and-techstars-startup-weekend": 3,
  "min-family-challenge": 4, "venturewell-e-team-program": 4, "usc-and-techstars-university-catalyst": 4, "deeptech-founder-matching": 4,
  "new-venture-seed-competition": 5, "innovation-catalyst-program-icp": 5, "viterbi-startup-garage": 5,
  "maseeh-entrepreneurship-prize-competition": 6, "viterbi-venture-fund": 6, "icp-startup-launch": 6, "california-life-sciences-fast-program": 6, "marshall-greif-incubator": 6, "usc-alumni-entrepreneurs-network-aen": 6,
  "iya-venture-showcase": 7, "usc-marshall-venture-fund": 7, "alfred-e-mann-institute-fund-ami": 7,
  "tech-coast-angels": 8, "usc-viterbi-startup-showcase": 8, "y-combinator": 8,
}
export const COLUMNS = 9
export const ZONES: { label: string; stage: Stage; from: number; to: number }[] = [
  { label: "Idea", stage: "idea", from: 0, to: 2 },
  { label: "Building", stage: "prototype", from: 3, to: 4 },
  { label: "Launched", stage: "launched", from: 5, to: 6 },
  { label: "Scaling", stage: "scaling", from: 7, to: 8 },
]

export const STATIONS = [...new Set(LINES.flatMap(l => l.stops))].filter(id => programById.has(id))
export const linesAt = (id: string) => LINES.filter(l => l.stops.includes(id))
export const isInterchange = (id: string) => linesAt(id).length > 1
export const onMap = (id: string) => STATIONS.includes(id)

/** Programs that are not map stations, grouped by how they should be presented. */
export function offMap(kind: Kind): Program[] {
  return programs.filter(p => kindOf(p) === kind && !onMap(p.id))
}

/** Next month (1-12) a program usually opens or runs, counting from this month. */
export function nextMonth(p: Program, from = new Date().getMonth() + 1): number | null {
  if (!p.months.length) return null
  return [...p.months].sort((a, b) => ((a - from + 12) % 12) - ((b - from + 12) % 12))[0]
}
export const monthName = (m: number | null) => (m ? MONTHS[m - 1] : null)

// ---------- Routing ----------

export interface Leg {
  line: Line
  stops: string[]
}

/**
 * Turns an ordered list of stops the AI chose into rides along the network: the shortest
 * path between each pair of consecutive stops, split into legs whenever the line changes.
 * Stops that are not on the map are returned separately.
 */
export function planRoute(stops: string[]): { legs: Leg[]; transfers: string[]; path: string[]; offMapStops: string[] } {
  const on = stops.filter(onMap)
  const offMapStops = stops.filter(s => !onMap(s) && programById.has(s))
  const edges = new Map<string, { to: string; line: Line }[]>()
  for (const l of LINES)
    l.stops.forEach((s, i) => {
      if (i === 0) return
      const a = l.stops[i - 1]
      edges.set(a, [...(edges.get(a) ?? []), { to: s, line: l }])
      edges.set(s, [...(edges.get(s) ?? []), { to: a, line: l }])
    })

  const steps: { from: string; to: string; line: Line }[] = []
  for (let i = 1; i < on.length; i++) {
    // Breadth-first search; ties prefer staying on the same line to avoid needless transfers.
    const prev = new Map<string, { from: string; line: Line }>()
    const queue = [on[i - 1]]
    const seen = new Set(queue)
    while (queue.length) {
      const cur = queue.shift()!
      if (cur === on[i]) break
      const lastLine = prev.get(cur)?.line
      const next = [...(edges.get(cur) ?? [])].sort((a, b) => Number(b.line === lastLine) - Number(a.line === lastLine))
      for (const e of next)
        if (!seen.has(e.to)) {
          seen.add(e.to)
          prev.set(e.to, { from: cur, line: e.line })
          queue.push(e.to)
        }
    }
    if (!prev.has(on[i])) continue // unreachable on the network; still listed as a stop
    const chain: { from: string; to: string; line: Line }[] = []
    for (let c = on[i]; c !== on[i - 1]; c = prev.get(c)!.from) chain.unshift({ from: prev.get(c)!.from, to: c, line: prev.get(c)!.line })
    steps.push(...chain)
  }

  const legs: Leg[] = []
  for (const s of steps) {
    const last = legs[legs.length - 1]
    if (last && last.line === s.line) last.stops.push(s.to)
    else legs.push({ line: s.line, stops: [s.from, s.to] })
  }
  const transfers = legs.slice(1).map(l => l.stops[0])
  const path = legs.length ? [legs[0].stops[0], ...legs.flatMap(l => l.stops.slice(1))] : on
  return { legs, transfers, path, offMapStops }
}

/** A compact description of the network for the AI prompt. */
export function networkPrompt(): string {
  const zone = (id: string) => ZONES.find(z => COLUMN[id] >= z.from && COLUMN[id] <= z.to)?.label ?? ""
  return LINES.map(l => `${l.name} line: ${l.stops.map(id => `${id} [${zone(id)}]`).join(" > ")}`).join("\n")
}

/** Keeps the AI's Now / Next / Later order (it matches the written answer) and orders stops by stage within each. */
export function forward(plan: { now: string[]; next: string[]; later: string[] }) {
  const col = (id: string) => COLUMN[id] ?? 4.5
  const by = (ids: string[]) => [...ids].sort((a, b) => col(a) - col(b))
  return { now: by(plan.now), next: by(plan.next), later: by(plan.later) }
}

/** Route <-> URL: horizons separated by "~", stops by ",". */
export function encodeRoute(r: { now: string[]; next: string[]; later: string[] }): string {
  return [r.now, r.next, r.later].map(h => h.join(",")).join("~")
}
export function decodeRoute(s: string): { now: string[]; next: string[]; later: string[]; support: string[] } | null {
  const valid = (h = "") => h.split(",").filter(id => programById.has(id))
  const parts = s.split("~")
  // Older links had one comma list: split it into thirds.
  if (parts.length === 1) {
    const all = valid(parts[0])
    const k = Math.max(1, Math.ceil(all.length / 3))
    return all.length ? { now: all.slice(0, k), next: all.slice(k, 2 * k), later: all.slice(2 * k), support: [] } : null
  }
  const [now, next, later] = [valid(parts[0]), valid(parts[1]), valid(parts[2])]
  return now.length + next.length + later.length ? { now, next, later, support: [] } : null
}

/** An ordered route drawn on the subway map: what to do now, next, and later. */
export interface RoutePlan {
  now: string[]
  next: string[]
  later: string[]
  /** Always-on support (mentoring, office hours, spaces, legal help) to lean on throughout. */
  support: string[]
}
