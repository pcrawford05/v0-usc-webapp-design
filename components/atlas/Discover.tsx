"use client"

import { Bookmark, BookmarkCheck, ChevronDown, Clock, List, Map as MapIcon, Route, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { courses, listed } from "@/lib/catalog"
import { applyFilters, CLEAR_ALL, isOpenNow, monthsAway, type Filters } from "@/lib/filters"
import { LINES, onMap } from "@/lib/network"
import { fitScore, type Profile } from "@/lib/profile"
import { AUDIENCE_LABELS, CATEGORIES, CATEGORY_COLORS, GROUPS, programs, GROUP_KEYS, STAGE_LABELS, programById, type Audience, type Program, type Stage } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"
import eventsData from "@/data/events.json"

const EVENTS_UPDATED = (eventsData as { updated: string }).updated

import { ShareButton } from "./extras"
import { CampusMap } from "./CampusMap"
import { keyFact } from "./shared"
import { SubwayMap, SubwayView } from "./Subway"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }
type Mode = "list" | "subway" | "campus" | "bubbles"

/** Featured order: flagship (on the map) first, then verified, then soonest, so the short list leads with the best bets. */
function featured(a: Program, b: Program) {
  return Number(onMap(b.id)) - Number(onMap(a.id)) || Number(b.confidence === "high") - Number(a.confidence === "high") || monthsAway(a) - monthsAway(b)
}

export function DiscoverView({ filters: f, setFilters, profile, mode, setMode, route, highlight, ...card }: CardProps & {
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  profile: Profile | null
  mode: Exclude<Mode, "bubbles">
  setMode: (m: Mode) => void
  route: string | null
  highlight: Set<string> | null
}) {
  const [draft, setDraft] = useState(f.q)
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    if (draft === f.q) return
    const t = setTimeout(() => setFilters({ q: draft }), 200)
    return () => clearTimeout(t)
  }, [draft, f.q, setFilters])

  // Searching looks through everything listed plus folded courses; browsing shows listed programs only.
  const pool = useMemo(() => {
    return f.q.trim() ? rankPrograms(f.q, 200).map(r => r.program).filter(p => listed.includes(p) || courses.includes(p)) : [...listed, ...courses]
  }, [f.q])
  const items = useMemo(() => {
    const out = applyFilters(pool, f)
    if (f.q.trim()) return out
    return [...out].sort((a, b) => (profile ? fitScore(b, profile) - fitScore(a, profile) : 0) || featured(a, b))
  }, [pool, f, profile])

  const count = (skip: Parameters<typeof applyFilters>[2], test: (p: Program) => boolean) => applyFilters(pool, f, skip).filter(test).length
  const chips: { label: string; clear: Partial<Filters> }[] = [
    f.type && { label: f.type, clear: { type: null } },
    f.who && { label: AUDIENCE_LABELS[f.who], clear: { who: null } },
    f.stage && { label: `${STAGE_LABELS[f.stage]} stage`, clear: { stage: null } },
    ...f.units.map(u => ({ label: GROUPS[u].short, clear: { units: f.units.filter(x => x !== u) } })),
    f.open && { label: "Open now", clear: { open: false } },
    f.verified && { label: "Verified", clear: { verified: false } },
  ].filter(Boolean) as { label: string; clear: Partial<Filters> }[]

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-full sm:basis-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Search programs"
            aria-label="Search programs"
            className="w-full rounded-2xl border border-black/5 bg-white/80 py-3 pl-10 pr-9 text-base outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm"
          />
          {draft && (
            <button onClick={() => setDraft("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <button onClick={() => setSheet(!sheet)} aria-expanded={sheet} data-tour="filters" className={cn("inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-semibold transition", sheet ? "border-primary/30 bg-primary/[.06] text-primary" : "border-black/5 bg-white/80 hover:bg-white")}>
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filters</span>
          {chips.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{chips.length}</span>}
        </button>
        <div className="ml-auto flex shrink-0 rounded-2xl border border-black/5 bg-white/80 p-1 sm:ml-0" role="group" aria-label="View">
          {([["campus", MapIcon, "Map"], ["subway", Route, "Routes"], ["list", List, "List"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} aria-label={label} title={label} className={cn("inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold", mode === k ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground")}>
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", sheet ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} aria-hidden={!sheet} inert={!sheet}>
        <div className="overflow-hidden">
          <div className="space-y-1 rounded-xl border border-black/[.06] bg-white/90 px-3 py-2">
            <Group label="For">
              {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                <Opt key={a} on={f.who === a} n={count("who", p => p.audience.includes(a))} onClick={() => setFilters({ who: f.who === a ? null : a })}>{AUDIENCE_LABELS[a]}</Opt>
              ))}
            </Group>
            <Group label="Stage">
              {(Object.keys(STAGE_LABELS) as Stage[]).map(s => (
                <Opt key={s} on={f.stage === s} n={count("stage", p => p.stage.includes(s))} onClick={() => setFilters({ stage: f.stage === s ? null : s })}>{STAGE_LABELS[s]}</Opt>
              ))}
            </Group>
            <Group label="School">
              {GROUP_KEYS.map(g => {
                const on = f.units.includes(g)
                if (!on && !count("units", p => p.group === g)) return null
                return (
                  <Opt key={g} on={on} n={count("units", p => p.group === g)} onClick={() => setFilters({ units: on ? f.units.filter(x => x !== g) : [...f.units, g] })}>
                    {GROUPS[g].short}
                  </Opt>
                )
              })}
            </Group>
            <Group label="Only">
              <Opt on={f.open} n={count("open", isOpenNow)} onClick={() => setFilters({ open: !f.open })}><Clock className="h-3 w-3" /> Open now</Opt>
              <Opt on={f.verified} n={count("verified", p => p.confidence !== "low")} onClick={() => setFilters({ verified: !f.verified })}><ShieldCheck className="h-3 w-3" /> Verified</Opt>
            </Group>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map(c => (
            <button key={c.label} onClick={() => setFilters(c.clear)} className="inline-flex items-center gap-1 rounded-full bg-foreground/[.07] py-1 pl-3 pr-2 text-xs font-medium hover:bg-foreground/[.12]">
              {c.label} <X className="h-3.5 w-3.5" />
            </button>
          ))}
          <button onClick={() => setFilters(CLEAR_ALL)} className="text-xs font-semibold text-primary hover:underline">Clear</button>
          <ShareButton title={`${items.length} USC programs on Founder Compass`} label="Copy link" />
        </div>
      )}

      {mode === "subway" ? (
        <RoutesPanel onOpen={card.onOpen} route={route} />
      ) : mode === "campus" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Where each program lives on the University Park and Health Sciences campuses. Tap a building to see what is there.</p>
          <CampusMap programs={listed} highlight={highlight} onOpen={card.onOpen} />
          <button onClick={() => setMode("bubbles")} className="mx-auto flex items-center gap-1.5 rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm font-semibold hover:bg-white">
            See every program as bubbles, by school
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">
              {items.length} <span className="font-normal text-muted-foreground">{f.q ? `results for "${f.q}"` : profile ? "programs, best fit first" : "programs"}</span>
            </span>
            <LastChecked />
          </div>
          {items.length ? (
            <ProgramList items={items} {...card} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing matches. <button onClick={() => (setFilters(CLEAR_ALL), setDraft(""))} className="font-semibold text-primary hover:underline">Start over</button>
            </div>
          )}
        </>
      )}

    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] sm:flex-wrap">{children}</div>
    </div>
  )
}

function Opt({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!n && !on}
      aria-pressed={on}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-35 sm:py-1", on ? "bg-primary text-primary-foreground" : "bg-black/[.05] hover:bg-black/[.08]")}
    >
      {children}
      <span className={cn("text-xs", on ? "text-primary-foreground/75" : "text-muted-foreground")}>{n}</span>
    </button>
  )
}

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const LAST_CHECK = programs.reduce((m, p) => (p.lastVerified && p.lastVerified > m ? p.lastVerified : m), "")

/** When the research run last checked the catalog, and when events last refreshed. */
function LastChecked() {
  if (!LAST_CHECK) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Each program is re-checked against its official page, socials and EngageSC">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Programs checked {fmt(LAST_CHECK)} · Events updated {fmt(EVENTS_UPDATED)}
    </span>
  )
}

/** A spreadsheet: one tight row per program, grouped under a header row per type. Groups fold. */
function ProgramList({ items, onOpen, isSaved, onToggleSave }: CardProps & { items: Program[] }) {
  // Courses and degrees start folded: a dropdown inside the list, opened when wanted.
  const [folded, setFolded] = useState<Set<string>>(new Set(["Courses & Degrees"]))
  const who = (p: Program) => {
    if (!p.audience.length) return null
    const names = p.audience.map(a => AUDIENCE_LABELS[a])
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")
  }
  // Groups follow the catalog's type order; within a group rows keep the incoming order (best fit or best match).
  // Courses go last, since they start folded.
  const order = [...CATEGORIES.filter(c => c !== "Courses & Degrees"), "Courses & Degrees" as const]
  const groups = order.map(c => ({ c, rows: items.filter(p => p.category === c) })).filter(g => g.rows.length)
  // Ctrl+Alt+T (Cmd+Option+T on a Mac) folds every group, or opens them all if they are already folded.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyT" || !e.altKey || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      setFolded(prev => (prev.size === groups.length ? new Set() : new Set(groups.map(g => g.c))))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [groups])
  const toggle = (c: string) => setFolded(prev => {
    const next = new Set(prev)
    next.has(c) ? next.delete(c) : next.add(c)
    return next
  })
  const cell = "border-r border-black/[.07] px-2.5 last:border-r-0"
  return (
    <div className="overflow-clip rounded-lg border border-black/[.1] bg-white text-xs shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[60%] sm:w-[260px]" />
          <col className="hidden lg:table-column" />
          <col className="hidden w-[92px] sm:table-column" />
          <col className="hidden w-[140px] md:table-column" />
          <col className="w-[40%] sm:w-[150px]" />
          <col className="w-9" />
        </colgroup>
        <thead className="sticky top-[60px] z-10 bg-[#f3f1ef] sm:top-[68px]">
          <tr className="h-8 border-b border-black/[.1] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className={cell}>Program</th>
            <th className={cn(cell, "hidden lg:table-cell")}>What it is</th>
            <th className={cn(cell, "hidden sm:table-cell")}>School</th>
            <th className={cn(cell, "hidden md:table-cell")}>For</th>
            <th className={cell}>Next</th>
            <th><span className="sr-only">Save</span></th>
          </tr>
        </thead>
        {groups.map(({ c, rows }) => {
          const closed = folded.has(c)
          return (
            <tbody key={c}>
              <tr className="h-8 cursor-pointer border-b border-black/[.1] bg-[#faf9f8] hover:bg-[#f5f3f1]" onClick={() => toggle(c)} title="Click to fold or open. Ctrl+Alt+T (Cmd+Option+T on Mac) folds or opens every group.">
                <td colSpan={6} className="px-2.5">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", closed && "-rotate-90")} />
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                    {c}
                    <span className="font-normal text-muted-foreground">{rows.length}</span>
                  </span>
                </td>
              </tr>
              {!closed && rows.map(p => {
                const fact = keyFact(p)
                const soon = fact === "Open this month"
                return (
                  <tr key={p.id} onClick={() => onOpen(p.id)} className="group h-8 cursor-pointer border-b border-black/[.06] hover:bg-[#fff8e6]">
                    <td className={cn(cell, "truncate font-medium text-foreground group-hover:text-primary")} title={p.name}>{p.name}</td>
                    <td className={cn(cell, "hidden truncate text-muted-foreground lg:table-cell")} title={p.description ?? undefined}>{p.description}</td>
                    <td className={cn(cell, "hidden truncate sm:table-cell")}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                        {GROUPS[p.group].short}
                      </span>
                    </td>
                    <td className={cn(cell, "hidden truncate text-muted-foreground md:table-cell")}>{who(p) ?? <span className="text-muted-foreground/60">Check</span>}</td>
                    <td className={cn(cell, "truncate", soon ? "font-semibold text-primary" : "text-foreground/80")}>{fact}</td>
                    <td className="text-center">
                      <button
                        onClick={e => (e.stopPropagation(), onToggleSave(p.id))}
                        aria-label={isSaved(p.id) ? `Unsave ${p.name}` : `Save ${p.name}`}
                        className="rounded p-1.5 text-muted-foreground hover:bg-black/[.05] hover:text-primary"
                      >
                        {isSaved(p.id) ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

/** Routes: the subway map of founder goals. Desktop gets the map; phones get each line as a short list. */
function RoutesPanel({ onOpen, route }: { onOpen: (id: string) => void; route: string | null }) {
  if (route) return <SubwayView onOpen={onOpen} initial={route} />
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Pick a goal, then ride the line</h2>
        <p className="text-sm text-muted-foreground">
          Each line is something founders want (money, a team, a product, a spinout), with stops in the order most students take them, from first step to biggest step. A stop on two lines helps with both.
        </p>
      </div>
      <div className="hidden sm:block">
        <SubwayMap onOpen={onOpen} />
      </div>
      <div className="space-y-2 sm:hidden">
        {LINES.map(l => (
          <details key={l.key} className="group rounded-2xl border border-black/5 bg-white/80">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: l.color }}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
              <span className="text-xs font-normal text-muted-foreground">{l.stops.length} stops</span>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <ol className="relative mx-4 mb-3 border-l-[3px] pl-4" style={{ borderColor: l.color }}>
              {l.stops.map(id => {
                const p = programById.get(id)
                if (!p) return null
                return (
                  <li key={id} className="relative py-1.5">
                    <span className="absolute -left-[23px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-[3px] bg-white" style={{ borderColor: l.color }} />
                    <button onClick={() => onOpen(id)} className="text-left text-sm text-foreground hover:underline">{p.name}</button>
                  </li>
                )
              })}
            </ol>
          </details>
        ))}
      </div>
    </div>
  )
}
