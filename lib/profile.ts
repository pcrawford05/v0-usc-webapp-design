import type { Audience, GroupKey, Program, Stage } from "@/lib/programs"

export const ROLES = [
  { key: "undergrad", label: "Undergrad", audience: ["undergrad"] },
  { key: "grad", label: "Master's / MBA", audience: ["grad"] },
  { key: "phd", label: "PhD / Postdoc", audience: ["phd", "postdoc"] },
  { key: "faculty", label: "Faculty / Staff", audience: ["faculty", "staff"] },
  { key: "alumni", label: "Alumni", audience: ["alumni"] },
] as const satisfies readonly { key: string; label: string; audience: Audience[] }[]

export const SCHOOLS = [
  { key: "viterbi", label: "Viterbi (Engineering)", group: "viterbi" },
  { key: "marshall", label: "Marshall (Business)", group: "marshall" },
  { key: "iya", label: "Iovine and Young Academy", group: "iya" },
  { key: "keck", label: "Keck / Health sciences", group: "keck" },
  { key: "other", label: "Another USC school", group: null },
] as const satisfies readonly { key: string; label: string; group: GroupKey | null }[]

export const STAGES = [
  { key: "idea", label: "Just an idea" },
  { key: "prototype", label: "Building" },
  { key: "launched", label: "Launched" },
  { key: "scaling", label: "Scaling" },
] as const satisfies readonly { key: Stage; label: string }[]

export const INTERESTS = [
  { key: "money", label: "Funding" },
  { key: "mentor", label: "Mentors & advice" },
  { key: "team", label: "A co-founder or team" },
  { key: "pitch", label: "Pitch & compete" },
  { key: "build", label: "Space & tools to build" },
  { key: "learn", label: "Learn the skills" },
  { key: "legal", label: "Legal, IP, or licensing" },
  { key: "network", label: "Investors & network" },
] as const

export type RoleKey = (typeof ROLES)[number]["key"]
export type SchoolKey = (typeof SCHOOLS)[number]["key"]
export type InterestKey = (typeof INTERESTS)[number]["key"]

export interface Profile {
  name?: string
  role?: RoleKey
  school?: SchoolKey
  stage?: Stage
  interests: InterestKey[]
  /** One or two sentences about what they are building, from the LinkedIn import or typed in. */
  venture?: string
}

export const EMPTY_PROFILE: Profile = { interests: [] }

export function hasProfile(p: Profile | null): p is Profile {
  return !!p && !!(p.role || p.school || p.stage || p.interests.length || p.venture)
}

/** Plain-language summary handed to the AI so answers are tailored. */
export function describeProfile(p: Profile): string {
  const parts = [
    p.role && `Role: ${ROLES.find(r => r.key === p.role)?.label}`,
    p.school && `School: ${SCHOOLS.find(s => s.key === p.school)?.label}`,
    p.stage && `Venture stage: ${STAGES.find(s => s.key === p.stage)?.label}`,
    p.interests.length && `Looking for: ${p.interests.map(i => INTERESTS.find(x => x.key === i)?.label).join(", ")}`,
    p.venture && `Building: ${p.venture}`,
  ].filter(Boolean)
  return parts.join(". ")
}

/** How well a program fits the profile. 0 means neutral; negative means likely ineligible. */
export function fitScore(program: Program, p: Profile): number {
  let s = 0
  const aud: readonly Audience[] = ROLES.find(r => r.key === p.role)?.audience ?? []
  if (aud.length) s += program.audience.some(a => aud.includes(a)) ? 2 : program.audience.length ? -2 : 0
  if (p.stage) s += program.stage.includes(p.stage) ? 1.5 : program.stage.length ? -0.5 : 0
  const group = SCHOOLS.find(x => x.key === p.school)?.group
  if (group && program.group === group) s += 1.5
  if (program.group === "external") s -= 0.5
  return s
}
