import programs from "@/data/programs.json"
import announced from "@/data/announced-events.json"
import sources from "@/data/sources.json"

// Live events from EngageSC (engage.usc.edu). Each catalog program whose group is on Engage has
// engageClubId in data/sources.json; we read that group's public iCal feed once a day.
// Locations are deliberately dropped: Engage hides them from the public and we do not republish them.

export interface EngageEvent {
  id: string
  title: string
  start: string // ISO
  end: string | null
  url: string
  host: string
  clubId: number
  programIds: string[]
}

const DAY = 60 * 60 * 24
const WINDOW_DAYS = 60

type Registry = Record<string, { engageClubId?: number }>

/** clubId -> catalog program ids that belong to that Engage group. */
export function engageClubs(): Map<number, string[]> {
  const out = new Map<number, string[]>()
  for (const [pid, entry] of Object.entries((sources as { programs: Registry }).programs)) {
    if (!entry.engageClubId) continue
    out.set(entry.engageClubId, [...(out.get(entry.engageClubId) ?? []), pid])
  }
  return out
}

// The host link should open the group itself (e.g. Brittingham), not one of its programs (Hult Prize).
function hostFirst(ids: string[], host: string) {
  const h = host.toLowerCase()
  const name = (id: string) => (programs as { id: string; name: string }[]).find(p => p.id === id)?.name.toLowerCase() ?? ""
  const isHost = (id: string) => {
    const n = name(id).replace(/\s*\(.*\)$/, "")
    return n.length > 3 && (h.includes(n) || n.includes(h))
  }
  return [...ids].sort((a, b) => Number(isHost(b)) - Number(isHost(a)))
}

function unfold(ics: string) {
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "")
}

function unescape(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim()
}

// DTSTART values come as UTC (20261026T190000Z) or as a bare date (20261026).
function toIso(v: string): string | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`
}

export function parseIcs(ics: string, clubId: number, programIds: string[]): EngageEvent[] {
  const events: EngageEvent[] = []
  for (const block of unfold(ics).split("BEGIN:VEVENT").slice(1)) {
    const field = (name: string) => {
      const line = block.split("\n").find(l => l.startsWith(name + ":") || l.startsWith(name + ";"))
      return line ? line.slice(line.indexOf(":") + 1) : null
    }
    const start = toIso(field("DTSTART") ?? "")
    const url = field("URL")
    if (!start || !url) continue
    const end = field("DTEND")
    const host = block.match(/ORGANIZER;CN="?([^":;]+)/)?.[1] ?? ""
    events.push({
      id: url.match(/id=(\d+)/)?.[1] ?? url,
      title: unescape(field("SUMMARY") ?? "Event"),
      start,
      end: end ? toIso(end) : null,
      url,
      host: host.trim(),
      clubId,
      programIds: hostFirst(programIds, host),
    })
  }
  return events
}

/** Upcoming events (next 60 days) for every catalog group on Engage. Each feed is cached for a day. */
export async function getEngageEvents(now = new Date()): Promise<EngageEvent[]> {
  const clubs = [...engageClubs()]
  const results = await Promise.all(
    clubs.map(async ([clubId, programIds]) => {
      try {
        const res = await fetch(`https://engage.usc.edu/ical/usc/ical_club_${clubId}.ics`, { next: { revalidate: DAY } })
        if (!res.ok) return []
        return parseIcs(await res.text(), clubId, programIds)
      } catch {
        return []
      }
    }),
  )
  const from = now.getTime() - DAY * 1000 // keep events that started today
  const to = now.getTime() + WINDOW_DAYS * DAY * 1000
  const seen = new Set<string>()
  // Events from official newsletters that the public Engage feed does not carry.
  const extra: EngageEvent[] = announced.events.map(e => ({ ...e, clubId: 0 }))
  return [...results.flat(), ...extra]
    .filter(e => {
      const t = Date.parse(e.start)
      if (t < from || t > to || seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}
