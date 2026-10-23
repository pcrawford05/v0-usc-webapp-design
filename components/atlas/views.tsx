"use client"

import { ArrowUp, ArrowUpDown, Bookmark, CalendarPlus, Compass, ChevronDown, Clock, LayoutGrid, Rows3, Search, ShieldCheck, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  AUDIENCE_LABELS,
  CATEGORIES,
  GROUPS,
  GROUP_KEYS,
  MONTHS,
  STAGE_LABELS,
  isAlwaysOn,
  programById,
  type Audience,
  type Program,
  type Stage,
} from "@/lib/programs"
import { applyFilters, CLEAR_ALL, isOpenNow, monthsAway, type Filters, type SortKey } from "@/lib/filters"
import { fitScore, matchChecklist, type Profile } from "@/lib/profile"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

import { ProgramTable } from "./ProgramTable"
import { EngageEvents, ShareButton, UpcomingStrip } from "./extras"
import { GroupPill, ProgramCard } from "./shared"
import { downloadReminders } from "@/lib/reminders"
import { encodeRoute } from "@/lib/network"
import { Itinerary, SubwayMap } from "./Subway"
import type { RoutePlan } from "@/lib/ai"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void; onAsk?: (q: string) => void }

function Grid({ items, reasons, profile, ...card }: CardProps & { items: Program[]; reasons?: Map<string, string>; profile?: Profile | null }) {
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No programs match yet. Try loosening a filter.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p, i) => (
        <ProgramCard
          key={p.id}
          index={i}
          program={p}
          reason={reasons?.get(p.id)}
          checks={profile ? matchChecklist(p, profile) : undefined}
          onOpen={card.onOpen}
          saved={card.isSaved(p.id)}
          onToggleSave={card.onToggleSave}
        />
      ))}
    </div>
  )
}

// ---------- Browse ----------

function Facet<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T | null
  options: { value: T; label: string; count: number }[]
  onChange: (v: T | null) => void
}) {
  return (
    <label className={cn("relative inline-flex min-w-0 max-w-full items-center rounded-xl glass pl-3 text-sm", value && "ring-2 ring-primary/40")}>
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={e => onChange((e.target.value || null) as T | null)}
        className="min-w-0 max-w-[calc(100vw-8rem)] cursor-pointer appearance-none truncate bg-transparent py-2.5 pl-1.5 pr-7 font-semibold text-foreground outline-none sm:max-w-none sm:py-2"
      >
        <option value="">Any</option>
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={!o.count && o.value !== value}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
    </label>
  )
}

function Toggle({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition", on ? "bg-primary text-primary-foreground shadow-sm" : "glass text-foreground/80 hover:text-foreground")}
    >
      {children}
      <span className={cn("text-xs font-normal", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
    </button>
  )
}

export function BrowseView({
  all,
  filters: f,
  setFilters,
  profile,
  saved = [],
  ...card
}: CardProps & { all: Program[]; filters: Filters; setFilters: (f: Partial<Filters>) => void; profile: Profile | null; saved?: string[] }) {
  const [layout, setLayoutState] = useState<"cards" | "table">("cards")
  const [draft, setDraft] = useState(f.q)
  useEffect(() => setDraft(f.q), [f.q])
  useEffect(() => {
    try { if (localStorage.getItem("atlas:browse") === "table") setLayoutState("table") } catch { /* ignore */ }
  }, [])
  const setLayout = (l: "cards" | "table") => {
    setLayoutState(l)
    try { localStorage.setItem("atlas:browse", l) } catch { /* ignore */ }
  }
  // Typing updates the URL after a short pause so history is not flooded.
  useEffect(() => {
    if (draft === f.q) return
    const t = setTimeout(() => setFilters({ q: draft }), 200)
    return () => clearTimeout(t)
  }, [draft, f.q, setFilters])

  const ranked = useMemo(() => (f.q.trim() ? rankPrograms(f.q, 200).map(r => r.program) : all), [f.q, all])
  const filtered = applyFilters(ranked, f)
  const count = (skip: Parameters<typeof applyFilters>[2], test: (p: Program) => boolean) => applyFilters(ranked, f, skip).filter(test).length

  const items = useMemo(() => {
    if (f.sort === "az") return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    if (f.sort === "soon") return [...filtered].sort((a, b) => (isAlwaysOn(a) ? 0.5 : monthsAway(a)) - (isAlwaysOn(b) ? 0.5 : monthsAway(b)))
    if (profile && !f.q) return [...filtered].sort((a, b) => fitScore(b, profile) - fitScore(a, profile))
    return filtered
  }, [filtered, f.sort, f.q, profile])

  const chips: { label: string; clear: Partial<Filters> }[] = [
    f.q && { label: `"${f.q}"`, clear: { q: "" } },
    f.type && { label: f.type, clear: { type: null } },
    f.who && { label: AUDIENCE_LABELS[f.who], clear: { who: null } },
    f.stage && { label: `${STAGE_LABELS[f.stage]} stage`, clear: { stage: null } },
    ...f.units.map(u => ({ label: GROUPS[u].short, clear: { units: f.units.filter(x => x !== u) } })),
    f.open && { label: "Open now", clear: { open: false } },
    f.verified && { label: "Verified", clear: { verified: false } },
  ].filter(Boolean) as { label: string; clear: Partial<Filters> }[]

  return (
    <div className="space-y-4">
      {!chips.length && <UpcomingStrip list={all} saved={saved} onOpen={card.onOpen} />}
      <div className="rounded-3xl glass p-3 sm:p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Search 203 programs: grants, biotech, pitch, co-founder..."
            aria-label="Search programs"
            className="w-full rounded-2xl border border-white/70 bg-white/70 py-3.5 pl-12 pr-4 text-base sm:text-[15px] shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] outline-none transition focus:bg-white focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Facet label="Type" value={f.type} onChange={type => setFilters({ type })}
            options={CATEGORIES.map(c => ({ value: c, label: c, count: count("type", p => p.category === c) }))} />
          <Facet label="For" value={f.who} onChange={who => setFilters({ who })}
            options={(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => ({ value: a, label: AUDIENCE_LABELS[a], count: count("who", p => p.audience.includes(a)) }))} />
          <Facet label="Stage" value={f.stage} onChange={stage => setFilters({ stage })}
            options={(Object.keys(STAGE_LABELS) as Stage[]).map(s => ({ value: s, label: STAGE_LABELS[s], count: count("stage", p => p.stage.includes(s)) }))} />
          <Toggle on={f.open} onClick={() => setFilters({ open: !f.open })} count={count("open", isOpenNow)}>
            <Clock className="h-4 w-4" /> Open now
          </Toggle>
          <Toggle on={f.verified} onClick={() => setFilters({ verified: !f.verified })} count={count("verified", p => p.confidence !== "low")}>
            <ShieldCheck className="h-4 w-4" /> Verified
          </Toggle>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {GROUP_KEYS.map(g => {
            const n = count("units", p => p.group === g)
            const on = f.units.includes(g)
            return (
              <button
                key={g}
                disabled={!n && !on}
                onClick={() => setFilters({ units: on ? f.units.filter(x => x !== g) : [...f.units, g] })}
                aria-pressed={on}
                className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition disabled:opacity-35", on ? "border-transparent text-white shadow-sm" : "border-white/70 bg-white/50 hover:bg-white")}
                style={on ? { backgroundColor: GROUPS[g].color } : undefined}
              >
                {!on && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUPS[g].color }} />}
                {GROUPS[g].short}
                <span className={on ? "text-white/80" : "text-muted-foreground"}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">
          {items.length} <span className="font-normal text-muted-foreground">of {all.length} programs</span>
        </span>
        {chips.map(c => (
          <button key={c.label} onClick={() => setFilters(c.clear)} className="inline-flex items-center gap-1 rounded-full bg-foreground/[.07] py-1 pl-3 pr-2 text-[13px] font-medium transition hover:bg-foreground/[.12]">
            {c.label} <X className="h-3.5 w-3.5" />
          </button>
        ))}
        {chips.length > 1 && (
          <button onClick={() => setFilters(CLEAR_ALL)} className="text-[13px] font-semibold text-primary hover:underline">
            Clear all
          </button>
        )}
        {chips.length > 0 && <ShareButton title={`${items.length} USC programs on Founder Compass`} label="Copy link to these results" />}
        <div className="ml-auto flex items-center gap-2">
          <label className="relative inline-flex items-center rounded-lg glass pl-2.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select value={f.sort} onChange={e => setFilters({ sort: e.target.value as SortKey })} aria-label="Sort" className="cursor-pointer appearance-none bg-transparent py-1.5 pl-1.5 pr-3 outline-none">
              <option value="best">{f.q ? "Best match" : profile ? "Best fit for you" : "Featured"}</option>
              <option value="soon">Happening soonest</option>
              <option value="az">A to Z</option>
            </select>
          </label>
          <div className="flex rounded-lg glass p-0.5" role="group" aria-label="Layout">
            {([["cards", LayoutGrid, "Cards"], ["table", Rows3, "Table"]] as const).map(([k, Icon, label]) => (
              <button
                key={k}
                onClick={() => setLayout(k)}
                aria-pressed={layout === k}
                aria-label={label}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1.5", layout === k ? "bg-white/90 text-primary shadow-sm" : "text-foreground/70 hover:text-foreground")}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {items.length ? (
        layout === "cards" ? <Grid items={items} profile={profile} {...card} /> : <ProgramTable items={items} {...card} />
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">Nothing matches every filter.</p>
          <p className="mt-1 text-sm text-muted-foreground">Remove a filter above, or ask the AI in your own words.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => setFilters(CLEAR_ALL)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Clear filters</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Calendar ----------

export function CalendarView({ all, onOpen, profile, saved = [] }: { all: Program[]; onOpen: (id: string) => void; profile: Profile | null; saved?: string[] }) {
  const now = new Date()
  const start = now.getMonth()
  const months = Array.from({ length: 12 }, (_, i) => ({ m: ((start + i) % 12) + 1, year: now.getFullYear() + Math.floor((start + i) / 12) }))
  const [showCourses, setShowCourses] = useState(false)
  const pool = showCourses ? all : all.filter(p => p.category !== "Courses & Degrees" && p.category !== "Student Organizations")
  const alwaysOn = pool.filter(isAlwaysOn)
  const [showAlways, setShowAlways] = useState(false)

  return (
    <div className="space-y-4">
      <UpcomingStrip list={pool} saved={saved} onOpen={onOpen} />
      <EngageEvents onOpen={onOpen} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Deadlines and events for the next 12 months, based on each program's usual cycle. Dates shift year to year, so confirm on the official page.
        </p>
        <label className="inline-flex items-center gap-2 rounded-lg glass px-3 py-1.5 text-sm">
          <input type="checkbox" checked={showCourses} onChange={e => setShowCourses(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Include courses and clubs
        </label>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-3">
        {months.map(({ m, year }, i) => {
          const inMonth = pool.filter(p => p.months.includes(m))
          const items = profile ? [...inMonth].sort((a, b) => fitScore(b, profile) - fitScore(a, profile)) : inMonth
          return (
            <section
              key={`${year}-${m}`}
              className={cn(
                "w-64 shrink-0 snap-start rounded-2xl border glass p-3",
                i === 0 ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border",
              )}
            >
              <header className="mb-2 flex items-baseline justify-between">
                <h3 className="text-lg font-bold">
                  {MONTHS[m - 1]} <span className="text-sm font-normal text-muted-foreground">{year}</span>
                </h3>
                {i === 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Now</span> : <span className="text-xs text-muted-foreground">{items.length}</span>}
              </header>
              <ul className="space-y-1.5">
                {items.map(p => (
                  <li key={p.id}>
                    <button onClick={() => onOpen(p.id)} className="w-full rounded-lg border-l-4 bg-muted/40 px-2.5 py-1.5 text-left text-sm transition hover:bg-muted" style={{ borderLeftColor: GROUPS[p.group].color }}>
                      <div className="font-medium leading-snug">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">{GROUPS[p.group].short} · {p.category}</div>
                    </button>
                  </li>
                ))}
                {!items.length && <li className="py-4 text-center text-sm text-muted-foreground">Nothing dated this month</li>}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="rounded-2xl glass p-4">
        <button onClick={() => setShowAlways(!showAlways)} className="flex w-full items-center justify-between text-left">
          <span className="font-semibold">Year-round and rolling ({alwaysOn.length})</span>
          <span className="text-sm text-primary">{showAlways ? "Hide" : "Show"}</span>
        </button>
        {showAlways && (
          <div className="mt-3 flex flex-wrap gap-2">
            {alwaysOn.map(p => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="rounded-full border border-border px-3 py-1 text-sm transition hover:bg-muted">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Ask AI ----------

export interface Turn {
  role: "user" | "assistant"
  content: string
  picks?: { id: string; reason: string }[]
  plan?: RoutePlan
  provider?: string
}

const SUGGESTIONS = [
  "I'm a sophomore with an app idea but no team. Where should I start?",
  "I'm a PhD student and my lab research might be a company",
  "We have a prototype and need our first $10K",
  "Plan my next 6 months",
]

export function AskView({
  turns,
  busy,
  onSend,
  ...card
}: CardProps & { turns: Turn[]; busy: boolean; onSend: (q: string) => void }) {
  const [input, setInput] = useState("")
  const [mapFor, setMapFor] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const send = (q: string) => {
    if (!q.trim() || busy) return
    onSend(q)
    setInput("")
  }
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns.length, busy])

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="space-y-4">
        {/* The advisor opens the conversation, so the page reads as a chat, not a search box. */}
        <Bubble>
          Hi, I'm the Founder Compass advisor. I know every USC entrepreneurship program, club and resource. Tell me a bit about you: your year or role, what you're building, and where you're stuck.
        </Bubble>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-10">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-white">
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end animate-pop-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">{t.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <Bubble>{t.content}</Bubble>
              {t.picks && t.picks.length > 0 && (
                <div className="space-y-1.5 pl-10">
                  {t.picks.map(p => {
                    const prog = programById.get(p.id)
                    if (!prog) return null
                    return (
                      <button key={p.id} onClick={() => card.onOpen(p.id)} className="flex w-full items-start gap-3 rounded-xl border border-black/5 bg-white/70 px-3 py-2.5 text-left transition hover:bg-white">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: GROUPS[prog.group].color }} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{prog.name}</span>
                          {p.reason && <span className="block text-xs text-muted-foreground">{p.reason}</span>}
                        </span>
                      </button>
                    )
                  })}
                  {t.plan && (
                    <button onClick={() => setMapFor(mapFor === i ? null : i)} className="text-xs font-semibold text-primary hover:underline">
                      {mapFor === i ? "Hide the map" : "See this as a route on the subway map"}
                    </button>
                  )}
                </div>
              )}
              {t.plan && mapFor === i && (
                <div className="space-y-3 pl-10 animate-pop-in">
                  <Itinerary route={t.plan} onOpen={card.onOpen} />
                  <SubwayMap route={t.plan} onOpen={card.onOpen} compact />
                  <a href={`?view=explore&mode=subway&route=${encodeRoute(t.plan)}`} className="inline-block text-xs font-semibold text-primary hover:underline">
                    Open on the full map
                  </a>
                </div>
              )}
              {t.provider === "local" && <p className="pl-10 text-xs text-muted-foreground">The advisor is offline right now, so these are keyword matches.</p>}
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map(k => <span key={k} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${k * 120}ms` }} />)}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => (e.preventDefault(), send(input))} className="sticky bottom-3 mt-6 flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 shadow-xl sm:bg-white/80 sm:backdrop-blur-xl">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={turns.length ? "Reply..." : "Tell the advisor about you..."}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none sm:text-sm"
          aria-label="Message the advisor"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="shrink-0 rounded-xl bg-primary p-3 text-primary-foreground transition hover:opacity-90 disabled:opacity-40 sm:p-2.5">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 animate-pop-in">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00]">
        <Compass className="h-3.5 w-3.5" />
      </span>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tl-md glass px-4 py-3 leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

// ---------- Saved ----------

export function SavedView({ saved, onAskPlan, ...card }: CardProps & { saved: string[]; onAskPlan: (q: string) => void }) {
  const items = saved.map(id => programById.get(id)).filter(Boolean) as Program[]
  if (!items.length)
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        <Bookmark className="mx-auto mb-2 h-6 w-6" />
        Save programs with the bookmark icon and they collect here, in this browser.
      </div>
    )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">{items.slice(0, 8).map(p => <GroupPill key={p.id} program={p} />)}</div>
        <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadReminders(items, "founder-compass-saved-deadlines.ics")}
          title="Downloads one calendar file. Open it and every saved program's deadline is added to your calendar, with a reminder two weeks ahead, repeating each year."
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white/60 px-4 py-2 text-sm font-semibold transition hover:bg-white"
        >
          <CalendarPlus className="h-4 w-4" /> Add my saved deadlines to my calendar
        </button>
        </div>
      </div>
      <UpcomingStrip list={items} saved={saved} onOpen={card.onOpen} title="Your saved programs coming up" />
      <Grid items={items} {...card} />
    </div>
  )
}
