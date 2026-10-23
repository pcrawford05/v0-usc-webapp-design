import { onMap, kindOf } from "@/lib/network"
import { programs, type Category, type Program } from "@/lib/programs"

// What the site lists versus what only the Advisor knows about.
// - listed: things a founder applies to or joins (programs, clubs, degrees). Shown in Discover.
// - course: individual courses, folded into one "Entrepreneurship courses" group per school.
// - advisor: always-on support, recurring events, outside reading, corporate partnerships.
//   Kept in the catalog so the Advisor can recommend them, but not given their own card.
export type Tier = "listed" | "course" | "advisor"

const DEGREE = /\b(B\.?S\.?|M\.?S\.?|MBA|Minor|Major|Certificate|Concentration|Emphasis|Program in)\b/i
const RECURRING = new Set(["weekly", "monthly", "semester", "ongoing"])
const OUTSIDE_READING: Category[] = ["Founder Toolkits", "Legal & IP"]

export function tierOf(p: Program): Tier {
  if (onMap(p.id)) return "listed" // subway stations always stay visible
  const kind = kindOf(p)
  if (kind === "course") return DEGREE.test(p.name) ? "listed" : "course"
  if (kind === "community") return "listed"
  if (kind === "service" || kind === "partner") return "advisor"
  if (p.group === "external" && OUTSIDE_READING.includes(p.category)) return "advisor"
  if (p.category === "Events & Speakers" && RECURRING.has(p.cadence) && !p.months.length) return "advisor"
  return "listed"
}

export const listed = programs.filter(p => tierOf(p) === "listed")
export const courses = programs.filter(p => tierOf(p) === "course")
export const advisorOnly = programs.filter(p => tierOf(p) === "advisor")

// Discover opens with one question. Each answer is a small set of categories.
export const NEEDS = [
  { key: "funding", label: "Funding", hint: "Grants, funds and prize money", categories: ["Funding & Grants", "Competitions & Pitch"] },
  { key: "team", label: "A team", hint: "Clubs, mixers and co-founder matching", categories: ["Student Organizations", "Events & Speakers"] },
  { key: "build", label: "To build", hint: "Accelerators, incubators and spaces", categories: ["Accelerators & Incubators", "Makerspaces & Coworking"] },
  { key: "learn", label: "To learn", hint: "Degrees, minors and courses", categories: ["Courses & Degrees"] },
  { key: "research", label: "Lab to market", hint: "Spinning out research", categories: ["Research Commercialization", "Legal & IP"] },
] as const satisfies readonly { key: string; label: string; hint: string; categories: readonly Category[] }[]
export type NeedKey = (typeof NEEDS)[number]["key"]
