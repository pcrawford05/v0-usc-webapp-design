import events from "@/data/events.json"
import { AUDIENCE_LABELS, GROUPS, MONTHS, programs, type Program } from "@/lib/programs"

// The Advisor hands off to the person's own ChatGPT or Claude. The prompt stays one short paragraph
// that points at /llms.txt, a plain list of facts we write ourselves, so there is nothing to inject.

export const ADVISOR_TASK =
  "Using what you know about me, give me the 5 most relevant USC programs from it, one line each on why, then ask me one short question about what I'm looking for."

export function advisorPrompt(origin: string, extra?: string) {
  return [`Read ${origin}/llms.txt. ${ADVISOR_TASK}`, extra?.trim()].filter(Boolean).join(" ")
}

const clip = (s: string | null, n: number) => (!s ? "" : s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)

function line(p: Program) {
  const who = p.audience.length ? p.audience.map(a => AUDIENCE_LABELS[a]).join("/") : "check eligibility"
  const when = p.months.length ? p.months.map(m => MONTHS[m - 1]).join("/") : p.cadence
  return `- ${p.name} | ${GROUPS[p.group].short} | ${p.category} | for: ${who} | when: ${when} | ${clip(p.description, 140)}${p.link ? ` | ${p.link}` : ""}`
}

export function pageText(origin: string) {
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
  return [
    "# Founder Compass: USC entrepreneurship programs",
    "",
    `Updated ${events.updated}. Source: ${origin}. Every program, club and course below is at USC.`,
    `Full data as JSON: ${origin}/programs.json (programs) and ${origin}/events.json (events and usual months). Corrections: pcrawfor@usc.edu.`,
    "",
    "## How to help",
    `${ADVISOR_TASK} Recommend only programs listed here and include each one's link. Dates shift each year, so tell the person to confirm on the program's page.`,
    "",
    "## Upcoming events",
    ...(events.events.length ? events.events.map(e => `- ${fmt(e.start)}: ${e.title} (${e.host}) ${e.url}`) : ["- None posted right now."]),
    "",
    `## Programs (${programs.length})`,
    "Name | unit | type | for | usual months | about | link",
    ...programs.map(line),
    "",
  ].join("\n")
}
