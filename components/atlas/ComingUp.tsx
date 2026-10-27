"use client"

import { Bookmark, ChevronDown, ExternalLink, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { bucket, calEntry, deadlineLabel, isSavedItem, matches, upcoming, type CalFilter, type Upcoming } from "@/lib/calendar"
import { loadEngageEvents, type LiveEvent } from "@/lib/engage-client"
import { GROUPS, MONTHS } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { AddToCalendar } from "./extras"

const TYPES = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "deadlines", label: "Deadlines" },
  { key: "saved", label: "Saved" },
] as const
const WHENS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const

const DAY = 86_400_000
const tz = { timeZone: "America/Los_Angeles" } as const

/** Live EngageSC events and program deadlines in one list, grouped by when they happen. */
export function ComingUp({ saved, onOpen }: { saved: string[]; onOpen: (id: string) => void }) {
  const params = useSearchParams()
  const router = useRouter()
  const [events, setEvents] = useState<LiveEvent[] | null>(null)
  const [showLater, setShowLater] = useState(false)
  useEffect(() => {
    loadEngageEvents().then(setEvents)
  }, [])

  // Filters live in the URL like Discover's: ?view=saved&c=events&w=week
  const f: CalFilter = {
    type: (TYPES.find(t => t.key === params.get("c"))?.key ?? "all") as CalFilter["type"],
    when: (WHENS.find(w => w.key === params.get("w"))?.key ?? "any") as CalFilter["when"],
  }
  const set = (c: Partial<CalFilter>) => {
    const next = new URLSearchParams(params.toString())
    const t = c.type ?? f.type
    const w = c.when ?? f.when
    t === "all" ? next.delete("c") : next.set("c", t)
    w === "any" ? next.delete("w") : next.set("w", w)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const all = useMemo(() => upcoming(events ?? []), [events])
  const count = (c: Partial<CalFilter>) => all.filter(u => matches(u, { ...f, ...c }, saved)).length
  const shown = all.filter(u => matches(u, f, saved))
  const buckets = bucket(shown, saved)
  const filtered = f.type !== "all" || f.when !== "any"

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Coming up</h1>
        <span className="text-xs text-muted-foreground">Events from EngageSC, updated daily · Deadlines by usual month</span>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter coming up">
        {TYPES.map(t => (
          <Chip key={t.key} on={f.type === t.key} n={count({ type: t.key })} onClick={() => set({ type: t.key })}>{t.label}</Chip>
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-black/10" aria-hidden />
        {WHENS.map(w => (
          <Chip key={w.key} on={f.when === w.key} n={count({ when: w.key })} onClick={() => set({ when: f.when === w.key ? "any" : w.key })}>{w.label}</Chip>
        ))}
        {filtered && (
          <button onClick={() => set({ type: "all", when: "any" })} className="inline-flex shrink-0 items-center gap-1 px-2 text-xs font-semibold text-primary hover:underline">
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      <div className="overflow-clip rounded-2xl border border-black/[.08] bg-white">
        {events === null && <div className="h-24 animate-pulse bg-black/[.03]" />}
        {events !== null && !buckets.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {f.type === "saved" ? "Nothing saved is coming up. Save programs from Discover to see their deadlines here." : "Nothing matches. Try loosening a filter."}
          </p>
        )}
        {buckets.map(b => {
          const folded = b.later && !showLater
          return (
            <div key={b.key}>
              <h2 className="sticky top-[60px] z-[1] flex items-baseline justify-between border-b border-black/[.06] bg-[#fbfaf9]/95 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur sm:top-[68px]">
                {b.later ? (
                  <button onClick={() => setShowLater(!showLater)} className="flex w-full items-center gap-2 text-left uppercase">
                    {b.label} <span className="font-normal normal-case">{b.items.length}</span>
                    <ChevronDown className={cn("ml-auto h-4 w-4 transition", showLater && "rotate-180")} />
                  </button>
                ) : (
                  <>
                    {b.label} <span className="font-normal normal-case">{b.items.length}</span>
                  </>
                )}
              </h2>
              {!folded && (
                <ul className="divide-y divide-black/[.06]">
                  {b.items.map(u => <Row key={u.key} u={u} saved={isSavedItem(u, saved)} onOpen={onOpen} />)}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Chip({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition", on ? "bg-foreground text-background" : "bg-white/80 text-foreground/80 ring-1 ring-black/[.06] hover:bg-white")}
    >
      {children}
      <span className={cn("font-normal", on ? "opacity-70" : "text-muted-foreground")}>{n}</span>
    </button>
  )
}

/** Exact dates get a countdown; month-only deadlines never do. */
function countdown(start: Date, now = new Date()): { label: string; tone: "red" | "amber" | "plain" } | null {
  const days = Math.floor((new Date(start.toLocaleDateString("en-US", tz)).getTime() - new Date(now.toLocaleDateString("en-US", tz)).getTime()) / DAY)
  if (days <= 0) return { label: "Today", tone: "red" }
  if (days === 1) return { label: "Tomorrow", tone: "amber" }
  if (days <= 6) return { label: `In ${days} days`, tone: "amber" }
  if (days <= 13) return { label: "Next week", tone: "plain" }
  return null
}

function Row({ u, saved, onOpen }: { u: Upcoming; saved: boolean; onOpen: (id: string) => void }) {
  const site = typeof window !== "undefined" ? window.location.origin : ""
  if (u.kind === "event") {
    const chip = countdown(u.start)
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <DateBlock top={u.start.toLocaleDateString("en-US", { ...tz, month: "short" })} big={u.start.toLocaleDateString("en-US", { ...tz, day: "numeric" })} bottom={u.start.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" })} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Kind event />
            {chip && <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", chip.tone === "red" ? "bg-primary text-primary-foreground" : chip.tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-black/[.05] text-foreground/70")}>{chip.label}</span>}
            {saved && <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Saved" />}
          </div>
          <div className="mt-0.5 line-clamp-2 font-semibold leading-snug text-foreground sm:truncate">{u.title}</div>
          {u.programId ? (
            <button onClick={() => onOpen(u.programId!)} className="block max-w-full truncate text-left text-xs text-muted-foreground hover:text-primary hover:underline">{u.host}</button>
          ) : (
            <div className="truncate text-xs text-muted-foreground">{u.host}</div>
          )}
        </div>
        <a href={u.url} target="_blank" rel="noreferrer" className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:inline-flex">
          RSVP on Engage <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a href={u.url} target="_blank" rel="noreferrer" aria-label="RSVP on EngageSC" className="rounded-lg p-2.5 text-primary hover:bg-black/[.05] sm:hidden">
          <ExternalLink className="h-4 w-4" />
        </a>
        <AddToCalendar compact entry={() => calEntry(u, site)} />
      </li>
    )
  }
  const p = u.program
  return (
    <li className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#f7f5f3]" onClick={() => onOpen(p.id)}>
      <DateBlock top={String(u.year)} big={MONTHS[u.month - 1]} bottom="usually" fuzzy />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Kind label={deadlineLabel(p)} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
            {GROUPS[p.group].short}
          </span>
          {saved && <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Saved" />}
        </div>
        <div className="mt-0.5 line-clamp-2 font-semibold leading-snug text-foreground sm:truncate">{p.name}</div>
        <div className="truncate text-xs text-muted-foreground">{p.category} · confirm the exact date on its page</div>
      </div>
      <AddToCalendar compact entry={() => calEntry(u, site)} />
    </li>
  )
}

function DateBlock({ top, big, bottom, fuzzy }: { top: string; big: string; bottom: string; fuzzy?: boolean }) {
  return (
    <div className={cn("flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5 leading-none", fuzzy ? "border border-dashed border-black/15 text-foreground/70" : "bg-primary/[.07] text-primary")}>
      <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{top}</span>
      <span className="mt-1 text-lg font-bold">{big}</span>
      <span className="mt-1 text-xs opacity-80">{bottom}</span>
    </div>
  )
}

function Kind({ event, label }: { event?: boolean; label?: string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", event ? "bg-[#2563A8]/10 text-[#2563A8]" : label === "Recruiting" ? "bg-[#A16207]/10 text-[#A16207]" : "bg-[#1B7F5C]/10 text-[#1B7F5C]")}>
      {event ? "Event" : label}
    </span>
  )
}
