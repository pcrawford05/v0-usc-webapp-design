import { listed } from "@/lib/catalog"
import type { LiveEvent } from "@/lib/engage-client"
import { MONTHS, type Program } from "@/lib/programs"

// ---------- One "Coming up" list: live EngageSC events plus program deadlines ----------
// Events have exact times. Deadlines only have a month, so they never get a fake day or countdown.

export type Upcoming =
  | { kind: "event"; key: string; title: string; start: Date; end: Date | null; host: string; url: string; programId: string | null }
  | { kind: "deadline"; key: string; title: string; month: number; year: number; program: Program }

export type CalFilter = { type: "all" | "events" | "deadlines" | "saved"; when: "any" | "week" | "month" }

const DAY = 86_400_000

/** Each listed program once, at its next cycle, plus every live event. */
export function upcoming(events: LiveEvent[], now = new Date()): Upcoming[] {
  const deadlines: Upcoming[] = listed.filter(onCalendar).map(p => nextDeadline(p, now))
  const live: Upcoming[] = events
    .map(e => ({ kind: "event" as const, key: `e-${e.id}`, title: e.title, start: new Date(e.start), end: e.end ? new Date(e.end) : null, host: e.host, url: e.url, programId: e.programIds[0] ?? null }))
    .filter(e => e.start.getTime() >= now.getTime() - 2 * 3600_000)
  return [...live, ...deadlines]
}

const RECURRING = new Set(["weekly", "monthly", "semester", "ongoing", "rolling"])

/** Only things with a real window to act on: no courses or degrees, no mixers that repeat every semester. */
export function onCalendar(p: Program): boolean {
  if (!p.months.length) return false
  if (p.category === "Courses & Degrees") return false
  if (p.category === "Events & Speakers" && RECURRING.has(p.cadence)) return false
  return true
}

/** Clubs recruit rather than take applications, so their rows say so. */
export const deadlineLabel = (p: Program) => (p.category === "Student Organizations" ? "Recruiting" : "Deadline")

/** A program's next cycle as a month-only deadline. */
export function nextDeadline(p: Program, now = new Date()): Extract<Upcoming, { kind: "deadline" }> {
  const thisMonth = now.getMonth() + 1
  const month = [...p.months].sort((a, b) => ((a - thisMonth + 12) % 12) - ((b - thisMonth + 12) % 12))[0]
  return { kind: "deadline", key: `d-${p.id}`, title: p.name, month, year: now.getFullYear() + (month < thisMonth ? 1 : 0), program: p }
}

export function matches(u: Upcoming, f: CalFilter, saved: string[], now = new Date()): boolean {
  if (f.type === "events" && u.kind !== "event") return false
  if (f.type === "deadlines" && u.kind !== "deadline") return false
  if (f.type === "saved" && !isSavedItem(u, saved)) return false
  if (f.when === "week") return u.kind === "event" && u.start.getTime() - now.getTime() < 7 * DAY
  if (f.when === "month") return u.kind === "event" ? u.start.getMonth() === now.getMonth() && u.start.getFullYear() === now.getFullYear() : u.month === now.getMonth() + 1
  return true
}

export const isSavedItem = (u: Upcoming, saved: string[]) => (u.kind === "deadline" ? saved.includes(u.program.id) : !!u.programId && saved.includes(u.programId))

export interface Bucket {
  key: string
  label: string
  items: Upcoming[]
  /** Folded away by default. */
  later?: boolean
}

/** This week (exact events), the rest of this month, the next two months, then everything later. */
export function bucket(items: Upcoming[], saved: string[], now = new Date()): Bucket[] {
  const monthIndex = (u: Upcoming) => (u.kind === "event" ? (u.start.getFullYear() - now.getFullYear()) * 12 + u.start.getMonth() - now.getMonth() : (u.year - now.getFullYear()) * 12 + u.month - 1 - now.getMonth())
  const time = (u: Upcoming) => (u.kind === "event" ? u.start.getTime() : Infinity)
  // Saved first, then events by time, then deadlines by name.
  const order = (a: Upcoming, b: Upcoming) => Number(isSavedItem(b, saved)) - Number(isSavedItem(a, saved)) || time(a) - time(b) || a.title.localeCompare(b.title)
  const week = items.filter(u => u.kind === "event" && u.start.getTime() - now.getTime() < 7 * DAY)
  const rest = items.filter(u => !week.includes(u))
  const out: Bucket[] = [{ key: "week", label: "This week", items: week.sort((a, b) => time(a) - time(b)) }]
  out.push({ key: "m0", label: "This month", items: rest.filter(u => monthIndex(u) === 0).sort(order) })
  for (const i of [1, 2]) {
    const m = (now.getMonth() + i) % 12
    out.push({ key: `m${i}`, label: FULL[m], items: rest.filter(u => monthIndex(u) === i).sort(order) })
  }
  out.push({ key: "later", label: "Later this year", items: rest.filter(u => monthIndex(u) > 2).sort((a, b) => monthIndex(a) - monthIndex(b) || order(a, b)), later: true })
  return out.filter(b => b.items.length)
}

const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** Month-only deadlines get a reminder two weeks before the month begins, so there is time to apply. */
export function reminderDate(month: number, now = new Date()): Date {
  let year = now.getFullYear()
  const at = (y: number) => new Date(y, month - 1, 1 - 14)
  if (at(year) <= now) year += 1
  return at(year)
}

// ---------- Add to calendar: Google (link) and Apple (calendar file the OS opens in Calendar) ----------

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, m => `\\${m}`).replace(/\n/g, "\\n")

export interface CalEntry {
  title: string
  details: string
  url?: string
  /** All-day entries carry a date; timed ones carry start and end. */
  allDay?: Date
  start?: Date
  end?: Date
  yearly?: boolean
}

/** An event, or a month-only deadline turned into an honest "check if it is open" reminder. */
export function calEntry(u: Upcoming, site: string): CalEntry {
  if (u.kind === "event") {
    return { title: u.title, start: u.start, end: u.end ?? new Date(u.start.getTime() + 3600_000), url: u.url, details: `Hosted by ${u.host}. RSVP and location on EngageSC: ${u.url}` }
  }
  const p = u.program
  return {
    title: `Check: ${p.name} (usually ${MONTHS[u.month - 1]})`,
    allDay: reminderDate(u.month),
    yearly: true,
    url: p.link ?? undefined,
    details: `${p.name} usually opens or has its deadline in ${MONTHS[u.month - 1]}. Confirm the exact date on its page.${p.link ? `\n${p.link}` : ""}\nFounder Compass: ${site}/?p=${p.id}`,
  }
}

export function googleCalendarUrl(e: CalEntry): string {
  const dates = e.allDay ? `${ymd(e.allDay)}/${ymd(new Date(e.allDay.getTime() + DAY))}` : `${utc(e.start!)}/${utc(e.end!)}`
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: e.details, ctz: "America/Los_Angeles" })
  if (e.yearly) q.set("recur", "RRULE:FREQ=YEARLY")
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** Apple Calendar opens calendar files directly, on iPhone and Mac. */
export function openInAppleCalendar(e: CalEntry) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Founder Compass//EN", "BEGIN:VEVENT",
    `UID:${Math.abs(hash(e.title + (e.allDay ?? e.start)))}@foundercompass`,
    `DTSTAMP:${utc(new Date())}`,
    ...(e.allDay ? [`DTSTART;VALUE=DATE:${ymd(e.allDay)}`, `DTEND;VALUE=DATE:${ymd(new Date(e.allDay.getTime() + DAY))}`] : [`DTSTART:${utc(e.start!)}`, `DTEND:${utc(e.end!)}`]),
    ...(e.yearly ? ["RRULE:FREQ=YEARLY"] : []),
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ]
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return h
}
