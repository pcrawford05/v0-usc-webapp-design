"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { GROUPS, GROUP_KEYS, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { whenLabel } from "./shared"

// One level at a time: units -> categories -> programs. Each level is a small physics
// simulation (never more than ~12 bodies) that drifts, collides, and scatters from the cursor.

interface Item {
  key: string
  name: string
  color: string
  programs: Program[]
  program?: Program
}
interface Body extends Item {
  base: number
  rv: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
}
type Level = { title: string; items: Item[] }

let W = 1000
let H = 700
const MAX_DIRECT = 12 // a unit with more programs than this is split into categories first

function rootLevel(programs: Program[]): Level {
  return {
    title: "All programs",
    items: GROUP_KEYS.map(g => ({ key: g, name: GROUPS[g].label, color: GROUPS[g].color, programs: programs.filter(p => p.group === g) })).filter(i => i.programs.length),
  }
}

function childLevel(item: Item): Level {
  if (item.programs.length <= MAX_DIRECT || item.program)
    return { title: item.name, items: item.programs.map(p => ({ key: p.id, name: p.name, color: item.color, programs: [p], program: p })) }
  const cats = [...new Set(item.programs.map(p => p.category))].sort()
  return {
    title: item.name,
    items: cats.map(c => ({ key: `${item.key}/${c}`, name: c, color: item.color, programs: item.programs.filter(p => p.category === c) })),
  }
}

function radiusFor(items: Item[]): (i: Item) => number {
  const leaf = items.every(i => i.program)
  if (leaf) {
    const r = Math.min(105, Math.sqrt((W * H * 0.42) / (Math.PI * items.length)))
    return () => r
  }
  const total = items.reduce((n, i) => n + i.programs.length, 0)
  const scale = Math.sqrt((W * H * 0.4) / (Math.PI * total))
  return i => Math.max(46, Math.min(170, Math.sqrt(i.programs.length) * scale))
}

function seed(items: Item[]): Body[] {
  const rf = radiusFor(items)
  return items.map((it, i) => {
    const a = (i / items.length) * Math.PI * 2
    const r = rf(it)
    return {
      ...it,
      r,
      base: r,
      rv: 0,
      x: W / 2 + Math.cos(a) * W * 0.28 + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin(a) * H * 0.25 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
    }
  })
}

function wrapLabel(name: string, r: number, fs: number): string[] {
  const max = Math.max(6, Math.floor((r * 1.55) / (fs * 0.56)))
  const lines: string[] = []
  for (const w of name.split(" ")) {
    const last = lines[lines.length - 1]
    if (last && (last + " " + w).length <= max) lines[lines.length - 1] = last + " " + w
    else lines.push(w)
  }
  return lines.length > 4 ? [...lines.slice(0, 3), lines.slice(3).join(" ").slice(0, max - 1) + "…"] : lines
}

export function BubbleMap({ programs, highlight, onOpen }: { programs: Program[]; highlight: Set<string> | null; onOpen: (id: string) => void }) {
  // Filtering removes non-matching bubbles entirely (no dimming), at every level.
  const visible = useMemo(() => (highlight ? programs.filter(p => highlight.has(p.id)) : programs), [programs, highlight])
  const root = useMemo(() => rootLevel(visible), [visible])
  const [stack, setStack] = useState<Level[]>([root])
  const level = stack[stack.length - 1]
  const [bodies, setBodies] = useState<Body[]>(() => seed(root.items))
  const sim = useRef<Body[]>(bodies)
  const pointer = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const hoverRef = useRef<string | null>(null)
  hoverRef.current = hover
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; r: number; color: string }[]>([])
  const enter = (key: string) => {
    if (hoverRef.current === key) return
    setHover(key)
    const b = sim.current.find(x => x.key === key)
    if (!b) return
    // shockwave: neighbors get a push that ripples through the cluster
    for (const o of sim.current) {
      if (o === b) continue
      const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1
      const f = Math.max(0, 1 - d / 420) * 5
      o.vx += (dx / d) * f
      o.vy += (dy / d) * f
    }
    const id = Date.now() + Math.random()
    setRipples(rs => [...rs.slice(-3), { id, x: b.x, y: b.y, r: b.base, color: b.color }])
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== id)), 900)
  }
  const reduced = useRef(false)
  const [portrait, setPortrait] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const apply = () => setPortrait(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  // Module-level size is read by the physics helpers; portrait gives phones bigger, readable bubbles.
  W = portrait ? 600 : 1000
  H = portrait ? 780 : 700

  useEffect(() => setStack([root]), [root])
  useEffect(() => {
    sim.current = seed(level.items)
    setBodies(sim.current)
  }, [level, portrait])

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    const tick = () => {
      const bs = sim.current
      const p = pointer.current
      for (const b of bs) {
        // gentle drift keeps things alive even without the cursor
        b.vx += (Math.random() - 0.5) * 0.05
        b.vy += (Math.random() - 0.5) * 0.05
        // hovered bubble swells, the rest shrink slightly; collisions push neighbors aside
        const hk = hoverRef.current
        const target = hk ? (b.key === hk ? Math.min(b.base * 1.45, b.base + 60) : b.base * 0.9) : b.base
        // spring with overshoot so size changes wobble into place
        b.rv = (b.rv + (target - b.r) * 0.16) * 0.78
        b.r += b.rv
        b.vx *= 0.96
        b.vy *= 0.96
        const sp = Math.hypot(b.vx, b.vy)
        if (sp > 14) (b.vx *= 14 / sp), (b.vy *= 14 / sp)
      }
      // elastic collisions between bubbles
      for (let i = 0; i < bs.length; i++)
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], b = bs[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.hypot(dx, dy) || 0.01
          const overlap = a.r + b.r + 4 - d
          if (overlap > 0) {
            const nx = dx / d, ny = dy / d
            const ma = a.r * a.r, mb = b.r * b.r
            a.x -= nx * overlap * (mb / (ma + mb)); a.y -= ny * overlap * (mb / (ma + mb))
            b.x += nx * overlap * (ma / (ma + mb)); b.y += ny * overlap * (ma / (ma + mb))
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
            if (rel < 0) {
              const imp = (-1.8 * rel) / (1 / ma + 1 / mb)
              a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny
              b.vx += (imp / mb) * nx; b.vy += (imp / mb) * ny
            }
          }
        }
      // walls
      for (const b of bs) {
        b.x += b.vx
        b.y += b.vy
        if (b.x < b.r) (b.x = b.r), (b.vx = Math.abs(b.vx) * 0.85)
        if (b.x > W - b.r) (b.x = W - b.r), (b.vx = -Math.abs(b.vx) * 0.85)
        if (b.y < b.r) (b.y = b.r), (b.vy = Math.abs(b.vy) * 0.85)
        if (b.y > H - b.r) (b.y = H - b.r), (b.vy = -Math.abs(b.vy) * 0.85)
      }
      setBodies([...bs])
      if (!reduced.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [level, portrait])

  const toLocal = (clientX: number, clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return
    pointer.current = { x: ((clientX - box.left) / box.width) * W, y: ((clientY - box.top) / box.height) * H, active: true }
  }

  const open = (b: Item) => {
    if (b.program) onOpen(b.program.id)
    else {
      setHover(null)
      setStack(s => [...s, childLevel(b)])
    }
  }
  const back = (i: number) => setStack(s => s.slice(0, i + 1))
  const hovered = bodies.find(b => b.key === hover)
  const listed = level.items.flatMap(i => i.programs)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm" aria-label="Map location">
          {stack.length > 1 && (
            <button onClick={() => back(stack.length - 2)} className="mr-1 inline-flex items-center gap-0.5 rounded-md border border-border px-2 py-0.5 transition hover:bg-muted">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          {stack.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <button onClick={() => back(i)} className={cn("rounded-md px-1.5 py-0.5 transition hover:bg-muted", i === stack.length - 1 ? "font-semibold" : "text-muted-foreground")}>
                {l.title}
              </button>
            </span>
          ))}
        </nav>

        {level.items.length === 0 && <p className="mb-2 text-sm text-muted-foreground">No programs match this search.</p>}
        <div className="relative overflow-hidden glass rounded-3xl">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full touch-none select-none"
            role="img"
            aria-label={`${level.title}: ${level.items.length} bubbles. Tap one to open it.`}
            onPointerMove={e => toLocal(e.clientX, e.clientY)}
            onPointerDown={e => toLocal(e.clientX, e.clientY)}
            onPointerLeave={() => ((pointer.current.active = false), setHover(null))}
            onPointerUp={e => e.pointerType !== "mouse" && (pointer.current.active = false)}
          >
            <defs>
              <radialGradient id="sheen" cx="35%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
                <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
              </radialGradient>
            </defs>
            {ripples.map(rp => (
              <circle key={rp.id} cx={rp.x} cy={rp.y} r={rp.r} fill="none" stroke={rp.color} strokeWidth={3} className="atlas-ripple" style={{ transformOrigin: `${rp.x}px ${rp.y}px` }} pointerEvents="none" />
            ))}
            {[...bodies].sort((a, z) => (a.key === hover ? 1 : 0) - (z.key === hover ? 1 : 0)).map(b => {
              const leaf = !!b.program
              const fs = Math.max(13, Math.min(leaf ? 19 : 24, b.r / (leaf ? 4.4 : 5)))
              const lines = wrapLabel(b.name, b.r, fs)
              const isHover = hover === b.key
              return (
                <g
                  key={b.key}
                  transform={`translate(${b.x},${b.y})`}
                  className="cursor-pointer"
                  onClick={() => open(b)}
                  onPointerEnter={() => enter(b.key)}
                  onPointerLeave={() => setHover(h => (h === b.key ? null : h))}
                >
                  <circle
                    r={b.r}
                    fill={b.color}
                    fillOpacity={leaf ? (b.program!.confidence === "low" ? 0.78 : 0.95) : 0.9}
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={isHover ? 4 : 2.5}
                    style={{ filter: isHover ? "drop-shadow(0 8px 18px rgba(0,0,0,.25))" : "drop-shadow(0 3px 8px rgba(0,0,0,.12))", transition: "r 150ms" }}
                  />
                  <circle r={b.r} fill="url(#sheen)" pointerEvents="none" />
                  {lines.map((line, i) => (
                    <text key={i} y={(i - (lines.length - 1) / 2) * fs * 1.15 - (leaf ? 0 : fs * 0.35)} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={700} fill="#fff" pointerEvents="none">
                      {line}
                    </text>
                  ))}
                  {!leaf && (
                    <text y={((lines.length - 1) / 2) * fs * 1.15 + fs * 0.85} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.62} fill="#fff" fillOpacity={0.85} pointerEvents="none">
                      {b.programs.length} program{b.programs.length === 1 ? "" : "s"}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          {hovered?.program && (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg border border-border bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur sm:right-auto sm:max-w-sm">
              <div className="font-semibold text-foreground">{hovered.name}</div>
              <div className="text-muted-foreground">{whenLabel(hovered.program)}</div>
              {hovered.program.description && <div className="mt-1 line-clamp-2 text-foreground/80">{hovered.program.description}</div>}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Hover a bubble to bring it forward. Tap one to open it.</p>
      </div>

      <aside className="rounded-2xl glass p-4 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In view</div>
        <div className="mt-0.5 font-semibold">{level.title}</div>
        <div className="text-xs text-muted-foreground">{listed.length} programs</div>
        <ul className="mt-3 space-y-0.5">
          {level.items.map(it => (
            <li key={it.key}>
              <button onClick={() => open(it)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted")}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
                <span className="flex-1 leading-snug">{it.name}</span>
                {!it.program && <span className="text-xs text-muted-foreground">{it.programs.length}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
