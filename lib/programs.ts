import programsData from "@/data/programs.json"

export type Cadence = "weekly" | "monthly" | "semester" | "annual" | "rolling" | "ongoing" | "one-time" | "unknown"
export type Audience = "undergrad" | "grad" | "phd" | "postdoc" | "faculty" | "staff" | "alumni" | "community"
export type Stage = "idea" | "prototype" | "launched" | "scaling"

export interface Program {
  id: string
  name: string
  aliases: string[]
  group: GroupKey
  category: Category
  description: string | null
  timing: string | null
  cadence: Cadence
  months: number[]
  eligibility: string | null
  audience: Audience[]
  stage: Stage[]
  funding: string | null
  link: string | null
  sources: string[]
  confidence: "high" | "medium" | "low"
  notes: string | null
}

export const GROUPS = {
  viterbi: { label: "Viterbi / Wang TIE Hub", short: "Viterbi", color: "#990000" },
  marshall: { label: "Marshall / Greif Center", short: "Marshall", color: "#1F4E79" },
  iya: { label: "Iovine and Young Academy", short: "IYA", color: "#6B3F8F" },
  joint: { label: "Joint Programs", short: "Joint", color: "#B5651D" },
  oori: { label: "Research & Innovation (OORI)", short: "OORI", color: "#2E7D6B" },
  keck: { label: "Keck MESH & Partners", short: "Keck", color: "#B0306A" },
  health: { label: "Health & Life Sciences", short: "Health", color: "#5E8C31" },
  clubs: { label: "Student Clubs", short: "Clubs", color: "#C98A00" },
  across: { label: "Across USC", short: "USC-wide", color: "#4F6874" },
  partners: { label: "Ecosystem Partners", short: "Partners", color: "#8A6A5C" },
  external: { label: "External Founder Resources", short: "External", color: "#3E4A52" },
} as const

export type GroupKey = keyof typeof GROUPS
export const GROUP_KEYS = Object.keys(GROUPS) as GroupKey[]

export const CATEGORIES = [
  "Funding & Grants",
  "Competitions & Pitch",
  "Accelerators & Incubators",
  "Mentorship & Office Hours",
  "Events & Speakers",
  "Courses & Degrees",
  "Makerspaces & Coworking",
  "Legal & IP",
  "Research Commercialization",
  "Student Organizations",
  "Partners & Ecosystem",
  "Founder Toolkits",
] as const
export type Category = (typeof CATEGORIES)[number]

export const AUDIENCE_LABELS: Record<Audience, string> = {
  undergrad: "Undergrad",
  grad: "Grad",
  phd: "PhD",
  postdoc: "Postdoc",
  faculty: "Faculty",
  staff: "Staff",
  alumni: "Alumni",
  community: "Community",
}

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  prototype: "Prototype",
  launched: "Launched",
  scaling: "Scaling",
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const programs = programsData as Program[]
export const programById = new Map(programs.map(p => [p.id, p]))

/** Programs that run year round, so they belong in every month of the calendar. */
export function isAlwaysOn(p: Program): boolean {
  return p.months.length === 0 && ["rolling", "ongoing", "weekly", "monthly"].includes(p.cadence)
}
