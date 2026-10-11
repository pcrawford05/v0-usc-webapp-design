"use client"

import { ChevronLeft } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { CATEGORIES, CATEGORY_COLORS, GROUPS, GROUP_KEYS, STAGE_LABELS, type Category, type GroupKey, type Program, type Stage } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { whenLabel } from "./shared"

type ViewProps = { programs: Program[]; onOpen: (id: string) => void }
const STAGE_ORDER: Stage[] = ["idea", "prototype", "launched", "scaling"]
const firstStage = (p: Program) => (p.stage.length ? Math.min(...p.stage.map(s => STAGE_ORDER.indexOf(s))) : 4)
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

// ---------- shared hover card ----------

function useTip() {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ p: Program; x: number; y: number } | null>(null)
  const show = (p: Program) => (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect()
    if (r) setTip({ p, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const card = tip && (
    <div
      className="pointer-events-none absolute z-10 w-64 rounded-xl glass-strong p-3 text-xs shadow-lg"
      style={{ left: Math.min(tip.x + 14, (box.current?.clientWidth ?? 600) - 270), top: tip.y + 14 }}
    >
      <div className="font-semibold text-foreground">{tip.p.name}</div>
      <div className="mt-0.5 text-muted-foreground">{GROUPS[tip.p.group].short} · {tip.p.category}</div>
      <div className="text-muted-foreground">{whenLabel(tip.p)}</div>
      {tip.p.description && <div className="mt-1 line-clamp-3 text-foreground/80">{tip.p.description}</div>}
    </div>
  )
  return { box, show, hide: () => setTip(null), card, hovered: tip?.p ?? null }
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
const categoryLegend = (programs: Program[]) =>
  CATEGORIES.filter(c => programs.some(p => p.category === c)).map(c => ({ label: c, color: CATEGORY_COLORS[c] }))

// ---------- 1. Constellation ----------

export function ConstellationView({ programs, onOpen }: ViewProps) {
  const W = 1000
  const H = 640
  const { box, show, hide, card, hovered } = useTip()
  const [focusCat, setFocusCat] = useState<Category | null>(null)
  const active = hovered?.category ?? focusCat

  const { stars, clusters } = useMemo(() => {
    const groups = GROUP_KEYS.filter(g => programs.some(p => p.group === g))
    const cols = Math.ceil(Math.sqrt(groups.length * (W / H)))
    const rows = Math.ceil(groups.length / cols)
    const stars: { p: Program; x: number; y: number; r: number }[] = []
    const clusters: { g: GroupKey; x: number; y: number; bottom: number; lines: [number, number][] }[] = []
    groups.forEach((g, gi) => {
      const row = Math.floor(gi / cols)
      const inRow = row === rows - 1 ? groups.length - row * cols : cols
      const cx = ((gi % cols) + 0.5 + (cols - inRow) / 2) * (W / cols)
      const cy = (row + 0.45) * (H / rows)
      const members = programs.filter(p => p.group === g)
      const span = Math.min(W / cols, H / rows) * 0.36
      const cats = [...new Set(members.map(p => p.category))].sort()
      const start = stars.length
      const lines: [number, number][] = []
      // Each type gets its own wedge of the cluster, so its stars sit together and its lines stay short.
      let angle = gi * 0.7
      cats.forEach(c => {
        const own = members.filter(p => p.category === c)
        const wedge = (own.length / members.length) * Math.PI * 2
        own.forEach((p, i) => {
          const t = (i + 0.5) / own.length
          const a = angle + wedge * (0.15 + 0.7 * ((i * 0.618) % 1))
          const d = span * (0.3 + 0.7 * Math.sqrt(t))
          stars.push({ p, x: cx + Math.cos(a) * d * 1.3, y: cy + Math.sin(a) * d, r: p.confidence === "low" ? 2.6 : 3.8 })
        })
        // Join the type's stars along a nearest-neighbour path so lines never cross the cluster.
        const left = own.map((_, i) => stars.length - own.length + i)
        let cur = left.shift()!
        while (left.length) {
          let best = 0
          left.forEach((k, j) => {
            if (Math.hypot(stars[k].x - stars[cur].x, stars[k].y - stars[cur].y) < Math.hypot(stars[left[best]].x - stars[cur].x, stars[left[best]].y - stars[cur].y)) best = j
          })
          const next = left.splice(best, 1)[0]
          lines.push([cur, next])
          cur = next
        }
        angle += wedge
      })
      const bottom = Math.max(...stars.slice(start).map(s => s.y)) + 24
      clusters.push({ g, x: cx, y: cy, bottom, lines })
    })
    return { stars, clusters }
  }, [programs])

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each star is a program and each constellation is a unit. Lines join programs of the same type. Hover a star to light up every program of that type across USC.
      </p>
      <div ref={box} className="relative overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_top,#1b2340,#070a16_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Program constellations" onPointerLeave={hide}>
          <defs>
            <radialGradient id="star-glow">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {Array.from({ length: 140 }, (_, i) => (
            <circle key={i} cx={(i * 397) % W} cy={(i * 211) % H} r={i % 7 === 0 ? 1 : 0.55} fill="#fff" opacity={0.25 + ((i * 13) % 10) / 30} />
          ))}
          {clusters.map(c =>
            c.lines.map(([a, b]) => {
              const lit = !active || stars[a].p.category === active
              return <line key={`${a}-${b}`} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} stroke={CATEGORY_COLORS[stars[a].p.category]} strokeOpacity={lit ? 0.75 : 0.12} strokeWidth={1.2} />
            }),
          )}
          {stars.map(s => {
            const lit = !active || s.p.category === active
            const color = CATEGORY_COLORS[s.p.category]
            return (
              <g key={s.p.id} transform={`translate(${s.x},${s.y})`} className="cursor-pointer" onPointerMove={show(s.p)} onClick={() => onOpen(s.p.id)} opacity={lit ? 1 : 0.22}>
                <circle r={14} fill="transparent" />
                {lit && active && <circle r={s.r * 4} fill="url(#star-glow)" opacity={0.5} />}
                <circle r={s.r + 1.6} fill={color} opacity={0.55} />
                <circle r={s.r} fill="#fff" />
                {hovered?.id === s.p.id && <circle r={s.r + 6} fill="none" stroke="#fff" strokeOpacity={0.8} />}
                <title>{s.p.name}</title>
              </g>
            )
          })}
          {clusters.map(c => (
            <text key={c.g} x={c.x} y={c.bottom} textAnchor="middle" fontSize={13} fontWeight={700} fill={GROUPS[c.g].color === "#3E4A52" ? "#cbd5e1" : "#fff"} opacity={0.85} letterSpacing="0.06em">
              {GROUPS[c.g].short.toUpperCase()}
            </text>
          ))}
        </svg>
        {card}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categoryLegend(programs).map(l => (
          <button
            key={l.label}
            onClick={() => setFocusCat(focusCat === l.label ? null : (l.label as Category))}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition", focusCat === l.label ? "bg-foreground text-background" : "glass hover:bg-white/70")}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- 2. Founder journey ----------

const STOPS: { key: Stage | "any"; label: string; blurb: string }[] = [
  { key: "idea", label: "Idea", blurb: "Exploring a problem, finding co-founders, first validation." },
  { key: "prototype", label: "Prototype", blurb: "Building an MVP, testing with users, first small grants." },
  { key: "launched", label: "Launched", blurb: "Live product, early revenue, accelerators and pitch competitions." },
  { key: "scaling", label: "Scaling", blurb: "Raising rounds, hiring, growth partners." },
  { key: "any", label: "Any stage", blurb: "Resources that fit wherever you are." },
]

export function JourneyView({ programs, onOpen, stage }: ViewProps & { stage?: Stage }) {
  const [sel, setSel] = useState<Stage | "any">(stage ?? "idea")
  const counts = STOPS.map(s => programs.filter(p => (s.key === "any" ? !p.stage.length : p.stage.includes(s.key))).length)
  const here = programs.filter(p => (sel === "any" ? !p.stage.length : p.stage.includes(sel)))
  const byCat = CATEGORIES.map(c => ({ c, items: here.filter(p => p.category === c) })).filter(x => x.items.length)
  const stop = STOPS.find(s => s.key === sel)!
  const W = 1000
  const xs = STOPS.map((_, i) => 80 + i * ((W - 160) / (STOPS.length - 1)))
  const ys = [120, 60, 120, 60, 120]
  const path = xs.map((x, i) => (i ? `C ${xs[i - 1] + 105} ${ys[i - 1]}, ${x - 105} ${ys[i]}, ${x} ${ys[i]}` : `M ${x} ${ys[i]}`)).join(" ")

  return (
    <div className="space-y-4">
      <div className="glass overflow-hidden rounded-3xl">
        <svg viewBox={`0 0 ${W} 180`} className="block h-auto w-full" role="img" aria-label="Founder journey">
          <path d={path} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={22} strokeLinecap="round" />
          <path d={path} fill="none" stroke="#990000" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" />
          {STOPS.map((s, i) => {
            const on = s.key === sel
            return (
              <g key={s.key} transform={`translate(${xs[i]},${ys[i]})`} className="cursor-pointer" onClick={() => setSel(s.key)}>
                <circle r={on ? 30 : 24} fill={on ? "#990000" : "#fff"} stroke={on ? "#FFCC00" : "rgba(153,0,0,.35)"} strokeWidth={on ? 4 : 2} style={{ transition: "all 250ms" }} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill={on ? "#fff" : "#990000"}>{counts[i]}</text>
                <text y={ys[i] > 90 ? 50 : -42} textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor" className="text-foreground">{s.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">{stop.label} <span className="font-normal text-muted-foreground">· {here.length} programs</span></h3>
        <p className="text-sm text-muted-foreground">{stop.blurb}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byCat.map(({ c, items }) => (
          <div key={c} className="glass rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
              {c}
              <span className="font-normal text-muted-foreground">{items.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map(p => (
                <button key={p.id} onClick={() => onOpen(p.id)} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs text-foreground shadow-sm transition hover:bg-white" title={whenLabel(p)}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- 3. Orbit ----------

export function OrbitView({ programs, onOpen }: ViewProps) {
  const W = 1000
  const H = 680
  const { box, show, hide, card, hovered } = useTip()
  const [focus, setFocus] = useState<GroupKey | null>(null)
  const groups = GROUP_KEYS.filter(g => programs.some(p => p.group === g))
  const focused = focus && groups.includes(focus) ? focus : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {focused ? (
          <>
          <button onClick={() => setFocus(null)} className="inline-flex items-center gap-0.5 rounded-md glass px-2 py-1 hover:bg-white/70">
            <ChevronLeft className="h-4 w-4" /> USC system
          </button>
          <span className="text-muted-foreground">Hover a moon to see the program; click to open it.</span>
          </>
        ) : (
          <span className="text-muted-foreground">USC at the center, each unit a planet, each program a moon. Click a planet to land on it.</span>
        )}
      </div>
      <div ref={box} className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,#1d1630,#0a0814_75%)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Program orbits" onPointerLeave={hide}>
          {Array.from({ length: 90 }, (_, i) => (
            <circle key={i} cx={(i * 389) % W} cy={(i * 233) % H} r={0.6} fill="#fff" opacity={0.3} />
          ))}
          {focused ? <Moons g={focused} programs={programs.filter(p => p.group === focused)} W={W} H={H} show={show} hovered={hovered} onOpen={onOpen} /> : (
            <>
              <ellipse cx={W / 2} cy={H / 2} rx={390} ry={250} fill="none" stroke="#fff" strokeOpacity={0.12} strokeDasharray="3 6" />
              <ellipse cx={W / 2} cy={H / 2} rx={230} ry={150} fill="none" stroke="#fff" strokeOpacity={0.1} strokeDasharray="3 6" />
              <circle cx={W / 2} cy={H / 2} r={62} fill="#990000" style={{ filter: "drop-shadow(0 0 30px rgba(255,204,0,.45))" }} />
              <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontSize={30} fontWeight={900} fill="#FFCC00">USC</text>
              {groups.map((g, i) => {
                // Bigger units sit on the inner ring; outside resources on the outer ring.
                const outer = g === "external" || g === "partners" || i % 2 === 1
                const ring = groups.filter((x, j) => (x === "external" || x === "partners" || j % 2 === 1) === outer)
                const k = ring.indexOf(g)
                const a = (k / ring.length) * Math.PI * 2 - Math.PI / 2 + (outer ? 0.3 : 0)
                const x = W / 2 + Math.cos(a) * (outer ? 390 : 230)
                const y = H / 2 + Math.sin(a) * (outer ? 250 : 150)
                const n = programs.filter(p => p.group === g).length
                const r = 16 + Math.sqrt(n) * 4.2
                return (
                  <g key={g} transform={`translate(${x},${y})`} className="cursor-pointer" onClick={() => setFocus(g)}>
                    {Array.from({ length: Math.min(n, 14) }, (_, m) => {
                      const ma = (m / Math.min(n, 14)) * Math.PI * 2
                      return <circle key={m} cx={Math.cos(ma) * (r + 9)} cy={Math.sin(ma) * (r + 9)} r={1.8} fill="#fff" opacity={0.55} />
                    })}
                    <circle r={r} fill={GROUPS[g].color} stroke="#fff" strokeOpacity={0.5} strokeWidth={1.5} className="transition hover:brightness-125" />
                    <circle r={r} fill="url(#planet-shade)" pointerEvents="none" />
                    <text y={r + 24} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">{GROUPS[g].short}</text>
                    <text y={r + 39} textAnchor="middle" fontSize={11} fill="#fff" opacity={0.6}>{n} programs</text>
                  </g>
                )
              })}
            </>
          )}
          <defs>
            <radialGradient id="planet-shade" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
            </radialGradient>
          </defs>
        </svg>
        {card}
      </div>
      <Legend items={focused ? categoryLegend(programs.filter(p => p.group === focused)) : groups.map(g => ({ label: GROUPS[g].label, color: GROUPS[g].color }))} />
    </div>
  )
}

function Moons({ g, programs, W, H, show, hovered, onOpen }: {
  g: GroupKey; programs: Program[]; W: number; H: number
  show: (p: Program) => (e: React.PointerEvent) => void; hovered: Program | null; onOpen: (id: string) => void
}) {
  const sorted = [...programs].sort((a, b) => a.category.localeCompare(b.category))
  // Fill rings from the inside out; each ring holds more moons than the last.
  const rings: Program[][] = []
  let cap = 8
  for (let i = 0; i < sorted.length; cap += 6) rings.push(sorted.slice(i, (i += cap)))
  const step = Math.min(95, 170 / Math.max(1, rings.length - 1))
  return (
    <>
      {rings.map((_, ri) => (
        <ellipse key={ri} cx={W / 2} cy={H / 2} rx={(150 + ri * step) * 1.45} ry={150 + ri * step} fill="none" stroke="#fff" strokeOpacity={0.1} strokeDasharray="3 6" />
      ))}
      <circle cx={W / 2} cy={H / 2} r={78} fill={GROUPS[g].color} />
      <circle cx={W / 2} cy={H / 2} r={78} fill="url(#planet-shade)" />
      <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff">{GROUPS[g].short}</text>
      <text x={W / 2} y={H / 2 + 16} textAnchor="middle" fontSize={12} fill="#fff" opacity={0.75}>{programs.length} programs</text>
      {rings.flatMap((ring, ri) =>
        ring.map((p, k) => {
          const a = (k / ring.length) * Math.PI * 2 - Math.PI / 2 + ri * 0.4
          const d = 150 + ri * step
          const x = W / 2 + Math.cos(a) * d * 1.45
          const y = H / 2 + Math.sin(a) * d
          const on = hovered?.id === p.id
          const right = Math.cos(a) >= 0
          return (
            <g key={p.id} transform={`translate(${x},${y})`} className="cursor-pointer" onPointerMove={show(p)} onClick={() => onOpen(p.id)}>
              <circle r={on ? 12 : 9} fill={CATEGORY_COLORS[p.category]} stroke="#fff" strokeWidth={on ? 2.5 : 1.2} style={{ transition: "r 200ms" }} />
              {(sorted.length <= 16 || on) && (
                <text x={right ? 15 : -15} textAnchor={right ? "start" : "end"} dominantBaseline="central" fontSize={on ? 13 : 11.5} fontWeight={on ? 700 : 400} fill="#fff" opacity={on ? 1 : 0.85} style={{ paintOrder: "stroke" }} stroke="#0a0814" strokeWidth={on ? 4 : 0}>
                  {clip(p.name, 28)}
                </text>
              )}
            </g>
          )
        }),
      )}
    </>
  )
}

// ---------- 6. Subway ----------

export function SubwayView({ programs, onOpen }: ViewProps) {
  const { box, show, hide, card, hovered } = useTip()
  const lines = CATEGORIES.map(c => ({ c, stops: programs.filter(p => p.category === c).sort((a, b) => firstStage(a) - firstStage(b) || a.name.localeCompare(b.name)) })).filter(l => l.stops.length)
  // Stations sit in the zone of the earliest stage they serve, so every line reads left (idea) to right (scaling).
  const GAP = 34
  const zones = [0, 1, 2, 3, 4].map(z => Math.max(1, ...lines.map(l => l.stops.filter(p => firstStage(p) === z).length)) * GAP + 30)
  const zoneX = zones.map((_, i) => 190 + zones.slice(0, i).reduce((a, b) => a + b, 0))
  const W = zoneX[4] + zones[4] + 30
  const ROW = 124
  const TOP = 120
  const H = TOP + lines.length * ROW
  const zoneNames = [...STAGE_ORDER.map(s => STAGE_LABELS[s]), "Any stage"]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each line is a kind of help. Ride left to right from Idea to Scaling; each station is a program, placed at the earliest stage it serves.
      </p>
      <div ref={box} className="relative" onPointerLeave={hide}>
      <div className="glass overflow-x-auto rounded-3xl">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "none" }} className="block h-auto" role="img" aria-label="Program subway map">
          {zones.map((w, i) => (
            <g key={i}>
              <rect x={zoneX[i] - 10} y={0} width={w} height={H} fill={i % 2 ? "rgba(0,0,0,.025)" : "transparent"} />
              <text x={zoneX[i] + w / 2 - 10} y={26} textAnchor="middle" fontSize={13} fontWeight={800} fill="#990000" letterSpacing="0.08em">{zoneNames[i].toUpperCase()}</text>
            </g>
          ))}
          {lines.map((l, li) => {
            const y = TOP + li * ROW + 40
            const color = CATEGORY_COLORS[l.c]
            const xs: number[] = []
            const seen = [0, 0, 0, 0, 0]
            l.stops.forEach(p => {
              const z = firstStage(p)
              xs.push(zoneX[z] + 10 + seen[z]++ * GAP)
            })
            return (
              <g key={l.c}>
                <text x={16} y={y} dominantBaseline="central" fontSize={12.5} fontWeight={700} fill={color}>{clip(l.c, 24)}</text>
                <line x1={xs[0]} x2={xs[xs.length - 1]} y1={y} y2={y} stroke={color} strokeWidth={7} strokeLinecap="round" />
                {l.stops.map((p, i) => {
                  const on = hovered?.id === p.id
                  return (
                    <g key={p.id} transform={`translate(${xs[i]},${y})`} className="cursor-pointer" onPointerMove={show(p)} onClick={() => onOpen(p.id)}>
                      <circle r={on ? 9 : 6.5} fill="#fff" stroke={color} strokeWidth={3} style={{ transition: "r 150ms" }} />
                      <text x={4} y={-14} transform="rotate(-38 4 -14)" fontSize={10.5} fill="currentColor" className={on ? "fill-foreground font-semibold" : "fill-foreground/75"}>
                        {clip(p.name, 22)}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
        {card}
      </div>
    </div>
  )
}
