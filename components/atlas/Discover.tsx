"use client"

import { Bookmark, BookmarkCheck, ChevronDown, Clock, List, Map as MapIcon, Route, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { courses, listed, NEEDS, type NeedKey } from "@/lib/catalog"
import { applyFilters, CLEAR_ALL, isOpenNow, monthsAway, type Filters } from "@/lib/filters"
import { LINES, onMap } from "@/lib/network"
import { fitScore, type Profile } from "@/lib/profile"
import { AUDIENCE_LABELS, GROUPS, GROUP_KEYS, STAGE_LABELS, programById, type Audience, type Program, type Stage } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

import { ShareButton } from "./extras"
import { CampusMap } from "./CampusMap"
import { keyFact } from "./shared"
import { SubwayMap, SubwayView } from "./Subway"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }
const FIRST = 25
type Mode = "list" | "subway" | "campus" | "bubbles"

/** Featured order: flagship (on the map) first, then verified, then soonest, so the short list leads with the best bets. */
function featured(a: Program, b: Program) {
  return Number(onMap(b.id)) - Number(onMap(a.id)) || Number(b.confidence === "high") - Number(a.confidence === "high") || monthsAway(a) - monthsAway(b)
}

export function DiscoverView({ filters: f, setFilters, need, setNeed, profile, mode, setMode, route, highlight, ...card }: CardProps & {
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  need: NeedKey | null
  setNeed: (n: NeedKey | null) => void
  profile: Profile | null
  mode: Exclude<Mode, "bubbles">
  setMode: (m: Mode) => void
  route: string | null
  highlight: Set<string> | null
}) {
  const [draft, setDraft] = useState(f.q)
  const [all, setAll] = useState(false)
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    if (draft === f.q) return
    const t = setTimeout(() => setFilters({ q: draft }), 200)
    return () => clearTimeout(t)
  }, [draft, f.q, setFilters])
  useEffect(() => setAll(false), [need, f])

  const needCats = need ? (NEEDS.find(n => n.key === need)!.categories as readonly string[]) : null
  // Searching looks through everything listed plus folded courses; browsing shows listed programs only.
  const pool = useMemo(() => {
    const base = f.q.trim() ? rankPrograms(f.q, 200).map(r => r.program).filter(p => listed.includes(p) || courses.includes(p)) : listed
    return needCats ? base.filter(p => needCats.includes(p.category)) : base
  }, [f.q, needCats])
  const items = useMemo(() => {
    const out = applyFilters(pool, f)
    if (f.q.trim()) return out
    return [...out].sort((a, b) => (profile ? fitScore(b, profile) - fitScore(a, profile) : 0) || featured(a, b))
  }, [pool, f, profile])
  const shown = all ? items : items.slice(0, FIRST)
  const showCourses = !f.q.trim() && (!need || need === "learn")

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
      <section className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">What do you need?</h1>
        <div data-tour="needs" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="What you need">
          {NEEDS.map(n => (
            <button
              key={n.key}
              role="radio"
              aria-checked={need === n.key}
              onClick={() => setNeed(need === n.key ? null : n.key)}
              title={n.hint}
              className={cn(
                "shrink-0 rounded-2xl px-4 py-2.5 text-[15px] font-semibold transition",
                need === n.key ? "bg-primary text-primary-foreground shadow-md" : "border border-black/5 bg-white/70 text-foreground hover:bg-white",
              )}
            >
              {n.label}
            </button>
          ))}
        </div>
        {need && <p className="text-sm text-muted-foreground">{NEEDS.find(n => n.key === need)!.hint}</p>}
      </section>

      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
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
        <button onClick={() => setSheet(true)} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-black/5 bg-white/80 px-3.5 py-3 text-sm font-semibold hover:bg-white">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {chips.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{chips.length}</span>}
        </button>
        <div className="flex shrink-0 rounded-2xl border border-black/5 bg-white/80 p-1" role="group" aria-label="View">
          {([["list", List, "List"], ["subway", Route, "Routes"], ["campus", MapIcon, "Map"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} aria-label={label} title={label} className={cn("inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold", mode === k ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground")}>
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map(c => (
            <button key={c.label} onClick={() => setFilters(c.clear)} className="inline-flex items-center gap-1 rounded-full bg-foreground/[.07] py-1 pl-3 pr-2 text-[13px] font-medium hover:bg-foreground/[.12]">
              {c.label} <X className="h-3.5 w-3.5" />
            </button>
          ))}
          <button onClick={() => setFilters(CLEAR_ALL)} className="text-[13px] font-semibold text-primary hover:underline">Clear</button>
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
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">
              {items.length} <span className="font-normal text-muted-foreground">{f.q ? `results for "${f.q}"` : profile ? "programs, best fit first" : "programs"}</span>
            </span>
          </div>
          {items.length ? (
            <ProgramList items={shown} {...card} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing matches. <button onClick={() => (setFilters(CLEAR_ALL), setDraft(""), setNeed(null))} className="font-semibold text-primary hover:underline">Start over</button>
            </div>
          )}
          {items.length > FIRST && (
            <button onClick={() => setAll(!all)} className="mx-auto flex items-center gap-1.5 rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm font-semibold hover:bg-white">
              {all ? "Show fewer" : `Show all ${items.length}`} <ChevronDown className={cn("h-4 w-4 transition", all && "rotate-180")} />
            </button>
          )}
          {showCourses && <CourseGroups onOpen={card.onOpen} />}
        </>
      )}

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-0 bg-white px-5 pb-8 pt-5 sm:mx-auto sm:max-w-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
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
            <Group label="School or unit">
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
            <Group label="Show only">
              <Opt on={f.open} n={count("open", isOpenNow)} onClick={() => setFilters({ open: !f.open })}><Clock className="h-3.5 w-3.5" /> Open now</Opt>
              <Opt on={f.verified} n={count("verified", p => p.confidence !== "low")} onClick={() => setFilters({ verified: !f.verified })}><ShieldCheck className="h-3.5 w-3.5" /> Verified</Opt>
            </Group>
            <button onClick={() => setSheet(false)} className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
              Show {items.length} programs
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Opt({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!n && !on}
      aria-pressed={on}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition disabled:opacity-35", on ? "bg-primary text-primary-foreground" : "bg-black/[.05] hover:bg-black/[.08]")}
    >
      {children}
      <span className={cn("text-xs", on ? "text-primary-foreground/75" : "text-muted-foreground")}>{n}</span>
    </button>
  )
}

/** Individual courses fold into one entry per school; the list opens on tap. */
function CourseGroups({ onOpen }: { onOpen: (id: string) => void }) {
  const bySchool = GROUP_KEYS.map(g => ({ g, items: courses.filter(p => p.group === g) })).filter(x => x.items.length)
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-foreground">Entrepreneurship courses</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {bySchool.map(({ g, items }) => (
          <details key={g} className="group rounded-2xl border border-black/5 bg-white/70 px-4 py-3 open:bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUPS[g].color }} />
              {GROUPS[g].short} courses
              <span className="font-normal text-muted-foreground">{items.length}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <ul className="mt-2 space-y-1">
              {items.map(p => (
                <li key={p.id}>
                  <button onClick={() => onOpen(p.id)} className="text-left text-sm text-foreground/85 hover:text-primary hover:underline">{p.name}</button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}

/** A table, not cards: one row per program so the whole catalog scans like a database. */
function ProgramList({ items, onOpen, isSaved, onToggleSave }: CardProps & { items: Program[] }) {
  const who = (p: Program) => {
    if (!p.audience.length) return "Check"
    const names = p.audience.map(a => AUDIENCE_LABELS[a])
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-black/5 text-xs uppercase tracking-wide text-muted-foreground sm:table-header-group">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Program</th>
            <th className="px-3 py-2.5 font-semibold">School</th>
            <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Type</th>
            <th className="hidden px-3 py-2.5 font-semibold md:table-cell">For</th>
            <th className="px-3 py-2.5 font-semibold">When</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {items.map(p => (
            <tr key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer transition hover:bg-black/[.025]">
              <td className="px-4 py-2.5">
                <div className="font-semibold text-foreground">{p.name}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground sm:hidden">
                  <span>{GROUPS[p.group].short}</span>·<span>{keyFact(p)}</span>
                </div>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                  {GROUPS[p.group].short}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">{p.category}</td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground md:table-cell">{who(p)}</td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">{keyFact(p)}</td>
              <td className="px-2 py-2.5 text-right">
                <button
                  onClick={e => (e.stopPropagation(), onToggleSave(p.id))}
                  aria-label={isSaved(p.id) ? `Unsave ${p.name}` : `Save ${p.name}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-black/[.05] hover:text-primary"
                >
                  {isSaved(p.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
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
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[15px] font-semibold" style={{ color: l.color }}>
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
