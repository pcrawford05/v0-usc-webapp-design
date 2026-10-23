"use client"

import { Bookmark, CalendarPlus, ChevronDown } from "lucide-react"
import { useState } from "react"

import { listed } from "@/lib/catalog"
import { monthsAway } from "@/lib/filters"
import { downloadReminders } from "@/lib/reminders"
import { GROUPS, MONTHS, programById, type Program } from "@/lib/programs"

import { EngageEvents } from "./extras"
import { ProgramCard } from "./shared"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }

/** Saved is "your dates": what is coming up at USC, your saved programs, and the rest of the year folded away. */
export function SavedView({ saved, ...card }: CardProps & { saved: string[] }) {
  const [allSoon, setAllSoon] = useState(false)
  const mine = saved.map(id => programById.get(id)).filter(Boolean) as Program[]
  const dated = listed.filter(p => p.months.length)
  const soon = dated.filter(p => monthsAway(p) <= 1).sort((a, b) => monthsAway(a) - monthsAway(b) || Number(saved.includes(b.id)) - Number(saved.includes(a.id)))
  const now = new Date().getMonth() + 1
  const later = Array.from({ length: 10 }, (_, i) => ((now + 1 + i) % 12) + 1).map(m => ({ m, items: dated.filter(p => p.months.includes(m)) })).filter(x => x.items.length)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Coming up</h1>
        <EngageEvents onOpen={card.onOpen} />
        <div className="rounded-2xl glass p-4">
          <h2 className="mb-2 font-semibold">Deadlines this month and next</h2>
          <ul className="divide-y divide-border">
            {(allSoon ? soon : soon.slice(0, 6)).map(p => (
              <li key={p.id}>
                <button onClick={() => card.onOpen(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm">
                  <span className="w-20 shrink-0 text-xs font-semibold text-primary">{monthsAway(p) === 0 ? "This month" : "Next month"}</span>
                  <span className="min-w-0 flex-1 font-medium">{p.name}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                  {saved.includes(p.id) && <Bookmark className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          {soon.length > 6 && (
            <button onClick={() => setAllSoon(!allSoon)} className="mt-2 text-sm font-semibold text-primary hover:underline">
              {allSoon ? "Show fewer" : `Show all ${soon.length}`}
            </button>
          )}
        </div>
        <details className="group rounded-2xl border border-black/5 bg-white/70 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            Later this year <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {later.map(({ m, items }) => (
              <div key={m}>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{MONTHS[m - 1]}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {items.map(p => (
                    <button key={p.id} onClick={() => card.onOpen(p.id)} className="rounded-full bg-black/[.05] px-3 py-1.5 text-[13px] hover:bg-black/[.08]">{p.name}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Your saved programs</h2>
          {mine.some(p => p.months.length) && (
            <button
              onClick={() => downloadReminders(mine, "founder-compass-saved-deadlines.ics")}
              className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3.5 py-2 text-sm font-semibold hover:bg-white"
            >
              <CalendarPlus className="h-4 w-4" /> Add to my calendar
            </button>
          )}
        </div>
        {mine.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((p, i) => <ProgramCard key={p.id} index={i} program={p} onOpen={card.onOpen} saved onToggleSave={card.onToggleSave} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Tap the bookmark on any program to keep it here, with its deadlines.
          </p>
        )}
      </section>
    </div>
  )
}
