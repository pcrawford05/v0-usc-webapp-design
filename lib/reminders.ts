import { MONTHS, type Program } from "@/lib/programs"

// Deadline reminders as standard calendar files (.ics): no account, no server, works with
// Google, Apple and Outlook. We only know the month a program usually runs, so each reminder
// lands two weeks before that month starts and repeats yearly.

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, m => `\\${m}`).replace(/\n/g, "\\n")

/** The next date a reminder for this month should fire: two weeks before the month begins. */
export function reminderDate(month: number, now = new Date()): Date {
  let year = now.getFullYear()
  const at = (y: number) => new Date(y, month - 1, 1 - 14)
  if (at(year) <= now) year += 1
  return at(year)
}

export const canRemind = (p: Program) => p.months.length > 0

function events(p: Program, site: string): string[] {
  return p.months.map(m => {
    const d = reminderDate(m)
    const end = new Date(d)
    end.setDate(end.getDate() + 1)
    return [
      "BEGIN:VEVENT",
      `UID:${p.id}-${m}@foundercompass`,
      `DTSTAMP:${ymd(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      "RRULE:FREQ=YEARLY",
      `SUMMARY:${esc(`${p.name}: usually ${MONTHS[m - 1]}`)}`,
      `DESCRIPTION:${esc(`${p.name} usually runs or has a deadline in ${MONTHS[m - 1]}. Confirm dates on the official page.${p.link ? `\n${p.link}` : ""}\nFounder Compass: ${site}/?p=${p.id}`)}`,
      ...(p.link ? [`URL:${p.link}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:PT9H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`${p.name} is coming up in ${MONTHS[m - 1]}`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n")
  })
}

export function icsFor(list: Program[], site: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Founder Compass//Deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Founder Compass deadlines", ...list.filter(canRemind).flatMap(p => events(p, site)), "END:VCALENDAR"].join("\r\n")
}

export function downloadReminders(list: Program[], filename: string) {
  const blob = new Blob([icsFor(list, window.location.origin)], { type: "text/calendar;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
