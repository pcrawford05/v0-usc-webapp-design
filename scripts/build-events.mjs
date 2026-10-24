// Builds data/events.json: every dated thing in the catalog in one file, so the site and the Advisor
// context (/page.txt) always have it without calling out at request time.
//   node scripts/build-events.mjs
// Run it as part of the weekly research run. It reads the public EngageSC calendar of every group with
// an engageClubId in data/sources.json (next 120 days, no locations), plus each program's usual months.
import { readFileSync, writeFileSync } from "node:fs"

const programs = JSON.parse(readFileSync("data/programs.json", "utf8")).filter(p => !p.archived)
const registry = JSON.parse(readFileSync("data/sources.json", "utf8")).programs
const live = new Set(programs.map(p => p.id))

const clubs = new Map()
for (const [id, entry] of Object.entries(registry)) {
  if (!entry.engageClubId || !live.has(id)) continue
  clubs.set(entry.engageClubId, [...(clubs.get(entry.engageClubId) ?? []), id])
}

const toIso = v => {
  const m = v?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`
}

function parse(ics, programIds) {
  const out = []
  for (const block of ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1)) {
    const field = name => {
      const line = block.split("\n").find(l => l.startsWith(name + ":") || l.startsWith(name + ";"))
      return line ? line.slice(line.indexOf(":") + 1) : null
    }
    const start = toIso(field("DTSTART"))
    const url = field("URL")
    if (!start || !url) continue
    out.push({
      id: url.match(/id=(\d+)/)?.[1] ?? url,
      title: (field("SUMMARY") ?? "Event").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim(),
      start,
      end: toIso(field("DTEND")),
      host: (block.match(/ORGANIZER;CN="?([^":;]+)/)?.[1] ?? "").trim(),
      url,
      programIds,
    })
  }
  return out
}

const now = Date.now()
const horizon = now + 120 * 864e5
const events = []
const seen = new Set()
for (const [clubId, ids] of clubs) {
  try {
    const res = await fetch(`https://engage.usc.edu/ical/usc/ical_club_${clubId}.ics`, { headers: { "User-Agent": "FounderCompass/1.0" } })
    if (!res.ok) continue
    for (const e of parse(await res.text(), ids)) {
      const t = Date.parse(e.start)
      if (t < now - 864e5 || t > horizon || seen.has(e.id)) continue
      seen.add(e.id)
      events.push(e)
    }
  } catch {
    console.warn(`Engage feed for club ${clubId} failed; skipped`)
  }
}
events.sort((a, b) => a.start.localeCompare(b.start))

const cycles = programs
  .filter(p => p.months.length)
  .map(p => ({ id: p.id, name: p.name, months: p.months, timing: p.timing }))

const out = { updated: new Date().toISOString().slice(0, 10), source: "EngageSC public calendars and data/programs.json", events, cycles }
writeFileSync("data/events.json", JSON.stringify(out, null, 2) + "\n")
console.log(`data/events.json: ${events.length} Engage events, ${cycles.length} program cycles`)
