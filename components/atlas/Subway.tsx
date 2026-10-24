"use client"

import { ArrowRight, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type { RoutePlan } from "@/lib/network"
import { COLUMN, COLUMNS, KIND_LABELS, LINES, STATIONS, ZONES, decodeRoute, encodeRoute, linesAt, monthName, nextMonth, offMap, planRoute, type Kind } from "@/lib/network"
import { GROUPS, programById, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { ShareButton } from "./extras"
import { whenLabel } from "./shared"

// ---------- Geometry ----------

const LEFT = 150
const COL_W = 128
const TOP = 74
const ROW_H = 96
const W = LEFT + COLUMNS * COL_W + 40
const H = TOP + (LINES.length - 1) * ROW_H + 70

// Interchanges sit between their lines' rows; one exception keeps a crossing clear of the Build line.
const Y_ROW_OVERRIDE: Record<string, number> = { "venturewell-e-team-program": 2 }

function pos(id: string): { x: number; y: number } {
  const rows = linesAt(id).map(l => LINES.indexOf(l))
  const row = Y_ROW_OVERRIDE[id] ?? rows.reduce((a, b) => a + b, 0) / rows.length
  return { x: LEFT + COLUMN[id] * COL_W + COL_W / 2, y: TOP + row * ROW_H }
}

/** Transit-map segment: horizontal, then a 45 degree diagonal, then horizontal. */
function seg(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dy = b.y - a.y
  if (!dy) return `L ${b.x} ${b.y}`
  const dx = b.x - a.x
  const d = Math.min(Math.abs(dy), Math.abs(dx))
  const run = (dx - Math.sign(dx) * d) / 2
  return `L ${a.x + run} ${a.y} L ${a.x + run + Math.sign(dx) * d} ${b.y} L ${b.x} ${b.y}`
}
const linePath = (ids: string[]) => ids.map((id, i) => (i ? seg(pos(ids[i - 1]), pos(id)) : `M ${pos(id).x} ${pos(id).y}`)).join(" ")

function shortName(p: Program): string[] {
  const name = p.name.replace(/\s*\(.*?\)\s*/g, " ").replace(/^USC (and )?/, "").replace(/ Competition$/, "").trim()
  const words = name.split(" ")
  const lines: string[] = [""]
  for (const w of words) {
    if ((lines[lines.length - 1] + " " + w).trim().length > 17 && lines[lines.length - 1]) lines.push(w)
    else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim()
  }
  return lines.length > 2 ? [lines[0], lines.slice(1).join(" ").slice(0, 16) + "…"] : lines
}

// ---------- Map ----------

export function SubwayMap({ route, onOpen, compact }: { route?: RoutePlan | null; onOpen: (id: string) => void; compact?: boolean }) {
  const [hover, setHover] = useState<string | null>(null)
  const stops = useMemo(() => (route ? [...route.now, ...route.next, ...route.later] : []), [route])
  const plan = useMemo(() => (stops.length ? planRoute(stops) : null), [stops])
  const lit = useMemo(() => new Set(plan?.path ?? []), [plan])
  const order = new Map(stops.filter(s => STATIONS.includes(s)).map((s, i) => [s, i + 1]))
  const horizon = (id: string) => (route?.now.includes(id) ? "Now" : route?.next.includes(id) ? "Next" : route?.later.includes(id) ? "Later" : null)
  const hp = hover ? programById.get(hover) : null
  const scroller = useRef<HTMLDivElement>(null)

  // On phones the map is wider than the screen: bring the start of the route into view.
  useEffect(() => {
    const el = scroller.current
    const first = plan?.path[0]
    if (!el || !first || el.scrollWidth <= el.clientWidth) return
    const scale = el.scrollWidth / W
    el.scrollTo({ left: Math.max(0, pos(first).x * scale - 60), behavior: "smooth" })
  }, [plan])

  return (
    <div className="relative">
      <div ref={scroller} className={cn("overflow-x-auto overscroll-x-contain rounded-3xl glass", compact && "rounded-2xl")}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[860px]" role="img" aria-label="USC startup subway map" onPointerLeave={() => setHover(null)}>
          <defs>
            <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {ZONES.map((z, i) => (
            <g key={z.label}>
              <rect x={LEFT + z.from * COL_W} y={0} width={(z.to - z.from + 1) * COL_W} height={H} fill={i % 2 ? "rgba(153,0,0,.035)" : "rgba(0,0,0,.012)"} />
              <text x={LEFT + (z.from + (z.to - z.from + 1) / 2) * COL_W} y={28} textAnchor="middle" fontSize={12} fontWeight={800} letterSpacing="0.14em" fill="#990000" opacity={0.75}>
                {z.label.toUpperCase()}
              </text>
            </g>
          ))}
          <text x={LEFT + 8.5 * COL_W} y={46} textAnchor="middle" fontSize={10} fill="currentColor" className="fill-muted-foreground">beyond USC</text>

          {LINES.map((l, i) => {
            const first = pos(l.stops[0])
            return (
              <g key={l.key} opacity={plan ? 0.18 : 1}>
                <text x={16} y={TOP + i * ROW_H} dominantBaseline="central" fontSize={13} fontWeight={800} fill={l.color}>{l.name}</text>
                <line x1={LEFT - 8} x2={first.x} y1={TOP + i * ROW_H} y2={first.y} stroke={l.color} strokeWidth={2} strokeDasharray="2 5" opacity={0.5} />
                <path d={linePath(l.stops)} fill="none" stroke={l.color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )
          })}

          {plan?.legs.map((leg, i) => (
            <g key={i}>
              <path d={linePath(leg.stops)} fill="none" stroke={leg.line.color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} filter="url(#route-glow)" />
              <path d={linePath(leg.stops)} fill="none" stroke={leg.line.color} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" className="atlas-route" pathLength={1} style={{ animationDelay: `${i * 0.35}s` }} />
            </g>
          ))}

          {STATIONS.map(id => {
            const p = programById.get(id)!
            const { x, y } = pos(id)
            const multi = linesAt(id).length > 1
            const isTransfer = plan?.transfers.includes(id)
            const n = order.get(id)
            const dim = plan && !lit.has(id)
            const label = shortName(p)
            return (
              <g key={id} transform={`translate(${x},${y})`} className="cursor-pointer" opacity={dim ? 0.35 : 1} onPointerEnter={() => setHover(id)} onClick={() => onOpen(id)}>
                <circle r={22} fill="transparent" />
                {multi ? (
                  <rect x={-11} y={-11} width={22} height={22} rx={11} fill="#fff" stroke="#111" strokeWidth={3.5} />
                ) : (
                  <circle r={hover === id ? 9 : 7} fill="#fff" stroke={linesAt(id)[0].color} strokeWidth={3.5} />
                )}
                {isTransfer && <circle r={17} fill="none" stroke="#111" strokeWidth={2} strokeDasharray="3 3" />}
                {n && (
                  <g transform="translate(13,-15)">
                    <circle r={10} fill="#111" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="#fff">{n}</text>
                  </g>
                )}
                {label.map((t, k) => (
                  <text key={k} y={22 + k * 13} textAnchor="middle" fontSize={11} fontWeight={n || multi ? 700 : 500} fill="currentColor" className="fill-foreground">
                    {t}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      {hp && (
        <div className="pointer-events-none absolute right-3 top-3 hidden w-72 rounded-2xl glass-strong p-3 text-xs shadow-lg sm:block">
          <div className="font-semibold text-foreground">{hp.name}</div>
          <div className="mt-0.5 text-muted-foreground">
            {GROUPS[hp.group].short} · {linesAt(hp.id).map(l => l.name).join(" + ")}
            {horizon(hp.id) && ` · ${horizon(hp.id)}`}
          </div>
          <div className="text-muted-foreground">{whenLabel(hp)}</div>
          {hp.description && <div className="mt-1 line-clamp-3 text-foreground/80">{hp.description}</div>}
        </div>
      )}
      <p className="mt-1.5 px-1 text-xs font-medium text-muted-foreground sm:hidden">Swipe the map sideways to see every line →</p>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-foreground/60 bg-white" /> Station</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-[3px] border-foreground bg-white" /> Interchange: serves two goals</span>
          <span>Zones show the stage a founder is usually at.</span>
        </div>
      )}
    </div>
  )
}

// ---------- Itinerary (Now / Next / Later) ----------

export function Itinerary({ route, onOpen }: { route: RoutePlan; onOpen: (id: string) => void }) {
  const plan = planRoute([...route.now, ...route.next, ...route.later])
  const cols: { key: keyof RoutePlan; label: string; hint: string }[] = [
    { key: "now", label: "Now", hint: "Start here" },
    { key: "next", label: "Next", hint: "Once that is underway" },
    { key: "later", label: "Later", hint: "Where you are heading" },
  ]
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {cols.map(c => (
          <div key={c.key} className="glass rounded-2xl p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-foreground">{c.label}</span>
              <span className="text-[11px] text-muted-foreground">{c.hint}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {route[c.key].length === 0 && <div className="text-xs text-muted-foreground">Nothing yet</div>}
              {route[c.key].map(id => <StopRow key={id} id={id} transfer={plan.transfers.includes(id)} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
      </div>
      {plan.legs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Ride:</span>
          {plan.legs.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 && <span>change at <b className="text-foreground">{programById.get(l.stops[0])?.name}</b> to</span>}
              <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ backgroundColor: l.line.color }}>{l.line.name}</span>
              {i < plan.legs.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
      )}
      {route.support.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-foreground">Lean on throughout:</span>
          {route.support.map(id => (
            <button key={id} onClick={() => onOpen(id)} className="rounded-full bg-white/70 px-2.5 py-1 shadow-sm hover:bg-white">{programById.get(id)?.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function StopRow({ id, transfer, onOpen }: { id: string; transfer: boolean; onOpen: (id: string) => void }) {
  const p = programById.get(id)
  if (!p) return null
  const lines = linesAt(id)
  const m = monthName(nextMonth(p))
  return (
    <button onClick={() => onOpen(id)} className="flex w-full items-start gap-2 rounded-xl bg-white/60 px-2.5 py-2 text-left text-sm shadow-sm transition hover:bg-white">
      <span className="mt-1.5 flex shrink-0 gap-0.5">
        {lines.length ? lines.map(l => <span key={l.key} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />) : <span className="h-2.5 w-2.5 rounded-full border border-foreground/40" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug text-foreground">{p.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {m ? `Usually ${m}` : whenLabel(p)}
          {transfer && " · interchange"}
          {!lines.length && " · off the map"}
        </span>
      </span>
    </button>
  )
}

// ---------- Explore tab ----------

export function SubwayView({ onOpen, initial }: { onOpen: (id: string) => void; profile?: string; initial?: string }) {
  // A route arrives only from a shared link or the Advisor; the map itself stays a calm overview.
  const [route, setRoute] = useState<RoutePlan | null>(() => (initial ? decodeRoute(initial) : null))
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Each line is a founder goal, running left to right from idea to scaling. Stations are programs; a station on two lines serves both goals. Tap any station for details.
      </p>
      {route && (
        <div className="space-y-2 animate-pop-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-foreground">Your route</span>
            <span className="flex gap-2">
              <ShareButton url={routeUrl(route)} title="My Founder Compass route" label="Share this route" />
              <button onClick={() => setRoute(null)} className="inline-flex items-center gap-1 rounded-full bg-foreground/[.07] px-3 py-1.5 text-[13px] font-semibold hover:bg-foreground/[.12]">
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </button>
            </span>
          </div>
          <Itinerary route={route} onOpen={onOpen} />
        </div>
      )}
      <SubwayMap route={route} onOpen={onOpen} />
      <OffMap onOpen={onOpen} />
    </div>
  )
}

// Not everything is a stop. Services are amenities, courses and clubs are places to learn and meet.
function OffMap({ onOpen }: { onOpen: (id: string) => void }) {
  const kinds: { kind: Kind; blurb: string }[] = [
    { kind: "service", blurb: "Mentoring, office hours, spaces and legal help. No deadline: use them at any stop." },
    { kind: "course", blurb: "Classes and degrees that build founder skills." },
    { kind: "community", blurb: "Student clubs where you meet co-founders and early users." },
    { kind: "program", blurb: "More programs with a cycle that are not on the main lines." },
    { kind: "partner", blurb: "Companies, investors and organizations USC works with." },
  ]
  const [open, setOpen] = useState<Kind | null>("service")
  return (
    <div className="glass rounded-3xl p-4">
      <div className="text-sm font-bold text-foreground">Off the map</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {kinds.map(k => (
          <button key={k.kind} onClick={() => setOpen(open === k.kind ? null : k.kind)} className={cn("rounded-full px-3 py-2 text-xs font-semibold transition sm:py-1", open === k.kind ? "bg-foreground text-background" : "bg-white/60 text-foreground/80 hover:bg-white")}>
            {k.kind === "program" ? "More programs" : KIND_LABELS[k.kind]} <span className="opacity-60">{offMap(k.kind).length}</span>
          </button>
        ))}
      </div>
      {open && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{kinds.find(k => k.kind === open)!.blurb}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {offMap(open).map(p => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-xs shadow-sm hover:bg-white sm:px-2.5 sm:py-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** A link that reopens this exact route on the subway. */
export function routeUrl(route: RoutePlan): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/?mode=subway&route=${encodeRoute(route)}`
}
