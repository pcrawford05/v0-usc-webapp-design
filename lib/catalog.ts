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
