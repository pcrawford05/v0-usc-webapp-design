"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { hierarchy, pack } from "d3-hierarchy"
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
  const pointer = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  // Bumped on every enter so re-hovering remounts the sparkles and restarts them.
  const [burst, setBurst] = useState(0)
  const enter = (key: string) => (setHover(key), setBurst(n => n + 1))
  const [portrait, setPortrait] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const apply = () => setPortrait(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  W = portrait ? 600 : 1000
  H = portrait ? 780 : 700
  useEffect(() => setStack([root]), [root])

  // Fixed layout: circle packing, sized by program count (equal size for programs).
  const bodies: Body[] = useMemo(() => {
    const h = hierarchy<{ children?: Item[] } & Partial<Item>>({ children: level.items })
      .sum(d => (d.programs ? (d.program ? 1 : Math.max(1, d.programs.length)) : 0))
      .sort((x, y) => (y.value ?? 0) - (x.value ?? 0))
    const laid = pack<{ children?: Item[] } & Partial<Item>>().size([W - 24, H - 24]).padding(level.items.length > 8 ? 10 : 18)(h)
    return (laid.children ?? []).map(n => ({ ...(n.data as Item), x: n.x + 12, y: n.y + 12, r: n.r, base: n.r, rv: 0, vx: 0, vy: 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                  <g style={{ transform: `scale(${isHover ? 1.07 : 1})`, transition: "transform 320ms cubic-bezier(.3,1.5,.5,1)" }}>
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
                  {isHover && <Sparkles key={burst} r={b.r} />}
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
        <p className="mt-2 text-xs text-muted-foreground">Tap a bubble to open it.</p>
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

// Four-point stars that pop around a bubble's rim once per hover.
const SPARKS = [
  { a: -0.7, d: 0.92, s: 1, t: 0 },
  { a: 0.35, d: 1.04, s: 0.6, t: 90 },
  { a: 1.3, d: 0.85, s: 0.8, t: 180 },
  { a: 2.4, d: 1.0, s: 0.55, t: 60 },
  { a: 3.4, d: 0.9, s: 0.9, t: 240 },
  { a: 4.5, d: 1.06, s: 0.65, t: 140 },
  { a: -0.2, d: 0.45, s: 0.5, t: 300 },
]
const STAR = "M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1Z"

function Sparkles({ r }: { r: number }) {
  const size = Math.max(7, Math.min(16, r * 0.16))
  return (
    <g pointerEvents="none" className="motion-reduce:hidden">
      {SPARKS.map((p, i) => (
        <g key={i} transform={`translate(${Math.cos(p.a) * r * p.d},${Math.sin(p.a) * r * p.d}) scale(${size * p.s})`}>
          <path d={STAR} fill="#fff" className="atlas-spark" style={{ animationDelay: `${p.t}ms`, filter: "drop-shadow(0 0 0.35px rgba(255,236,170,.95))" }} />
        </g>
      ))}
    </g>
  )
}
