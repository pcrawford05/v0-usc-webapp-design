"use client"

import { hierarchy, pack, type HierarchyCircularNode } from "d3-hierarchy"
import { ChevronRight, Minus, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { GROUPS, GROUP_KEYS, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { whenLabel } from "./shared"

interface Datum {
  key: string
  name: string
  color?: string
  program?: Program
  children?: Datum[]
}
type Node = HierarchyCircularNode<Datum>
type View = [number, number, number] // cx, cy, diameter

const SIZE = 1000

function buildTree(programs: Program[]): Datum {
  return {
    key: "root",
    name: "All programs",
    children: GROUP_KEYS.map(g => {
      const inGroup = programs.filter(p => p.group === g)
      const cats = [...new Set(inGroup.map(p => p.category))].sort()
      const leaf = (p: Program): Datum => ({ key: p.id, name: p.name, color: GROUPS[g].color, program: p })
      // Only add a category ring when it actually separates something.
      const children =
        cats.length > 1 && inGroup.length > 6
          ? cats.map(c => ({
              key: `${g}/${c}`,
              name: c,
              color: GROUPS[g].color,
              children: inGroup.filter(p => p.category === c).map(leaf),
            }))
          : inGroup.map(leaf)
      return { key: g, name: GROUPS[g].label, color: GROUPS[g].color, children }
    }).filter(g => g.children.length),
  }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function BubbleMap({
  programs,
  highlight,
  onOpen,
}: {
  programs: Program[]
  highlight: Set<string> | null
  onOpen: (id: string) => void
}) {
  const root = useMemo(() => {
    const h = hierarchy(buildTree(programs))
      .sum(d => (d.program ? 1 : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    return pack<Datum>().size([SIZE, SIZE]).padding(d => (d.depth === 0 ? 14 : d.depth === 1 ? 7 : 3))(h)
  }, [programs])

  const [focus, setFocus] = useState<Node>(root)
  const [view, setView] = useState<View>([root.x, root.y, root.r * 2])
  const [hover, setHover] = useState<{ node: Node; x: number; y: number } | null>(null)
  const viewRef = useRef(view)
  const frame = useRef<number>(0)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFocus(root)
    setView([root.x, root.y, root.r * 2])
    viewRef.current = [root.x, root.y, root.r * 2]
  }, [root])

  const zoomTo = useCallback((node: Node) => {
    setFocus(node)
    setHover(null)
    const from = viewRef.current
    const to: View = [node.x, node.y, node.r * 2 + (node.depth ? 24 : 0)]
    const start = performance.now()
    const dur = 650
    cancelAnimationFrame(frame.current)
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - start) / dur))
      const v: View = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
      viewRef.current = v
      setView(v)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const k = SIZE / view[2]
  const tx = (x: number) => (x - view[0]) * k + SIZE / 2
  const ty = (y: number) => (y - view[1]) * k + SIZE / 2

  const nodes = root.descendants().slice(1)
  const path = focus.ancestors().reverse()
  const visibleLeaves = focus.leaves()

  const handleClick = (n: Node) => {
    if (n.data.program) onOpen(n.data.program.id)
    else if (n === focus && n.parent) zoomTo(n.parent)
    else zoomTo(n)
  }

  const isDim = (n: Node) => {
    if (!highlight) return false
    if (n.data.program) return !highlight.has(n.data.program.id)
    return !n.leaves().some(l => l.data.program && highlight.has(l.data.program.id))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm" aria-label="Map location">
          {path.map((n, i) => (
            <span key={n.data.key} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <button
                onClick={() => zoomTo(n)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 transition hover:bg-muted",
                  n === focus ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {n.data.name}
              </button>
            </span>
          ))}
          <span className="ml-auto flex gap-1">
            <button
              aria-label="Zoom out"
              disabled={!focus.parent}
              onClick={() => focus.parent && zoomTo(focus.parent)}
              className="rounded-md border border-border p-1 transition hover:bg-muted disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              aria-label="Zoom in to largest cluster"
              disabled={!focus.children?.some(c => c.children)}
              onClick={() => {
                const next = focus.children?.find(c => c.children)
                if (next) zoomTo(next)
              }}
              className="rounded-md border border-border p-1 transition hover:bg-muted disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </span>
        </nav>

        <div ref={wrap} className="relative mx-auto max-w-[min(100%,calc(100vh-230px))] overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_40%,#fff,#f6f1ea)]">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="block aspect-square w-full touch-manipulation select-none"
            role="img"
            aria-label="Bubble map of USC entrepreneurship programs. Click a cluster to zoom in."
            onClick={() => focus.parent && zoomTo(focus.parent)}
            onMouseLeave={() => setHover(null)}
          >
            {nodes.map(n => {
              const r = n.r * k
              if (r < 0.6) return null
              const leaf = !!n.data.program
              const color = n.data.color ?? "#999"
              const dim = isDim(n)
              // Leaves sitting directly in the focus are crisp; leaves tucked inside a sub-cluster fade so its label reads.
              const leafOpacity = !leaf ? 1 : n.parent === focus ? 1 : n.ancestors().includes(focus) ? 0.4 : 0.22
              return (
                <circle
                  key={n.data.key}
                  cx={tx(n.x)}
                  cy={ty(n.y)}
                  r={r}
                  fill={leaf ? color : n.depth === 1 ? `${color}1F` : `${color}14`}
                  stroke={leaf ? "#fff" : color}
                  strokeOpacity={leaf ? 0.9 : n.depth === 1 ? 0.55 : 0.3}
                  strokeWidth={leaf ? 1.5 : n === focus ? 2.5 : 1.2}
                  opacity={dim ? 0.12 : leafOpacity * (leaf && n.data.program!.confidence === "low" ? 0.8 : 1)}
                  className={cn("cursor-pointer transition-[opacity] duration-300", leaf && "hover:brightness-110")}
                  onClick={e => (e.stopPropagation(), handleClick(n))}
                  onMouseMove={e => {
                    const box = wrap.current?.getBoundingClientRect()
                    if (box) setHover({ node: n, x: e.clientX - box.left, y: e.clientY - box.top })
                  }}
                >
                  <title>{n.data.name}</title>
                </circle>
              )
            })}

            {/* Labels: clusters directly inside the focus, plus leaves once they are big enough to read */}
            {nodes.map(n => {
              const r = n.r * k
              const leaf = !!n.data.program
              const showCluster = !leaf && n.parent === focus && r > 34
              const showLeaf = leaf && r > 40 && n.ancestors().includes(focus)
              if (!showCluster && !showLeaf) return null
              const fs = Math.max(13, Math.min(leaf ? 20 : 26, r / (leaf ? 4.2 : 5.6)))
              const words = n.data.name.split(" ")
              const lines: string[] = []
              const maxChars = Math.max(6, Math.floor((r * 1.6) / (fs * 0.55)))
              for (const w of words) {
                const last = lines[lines.length - 1]
                if (last && (last + " " + w).length <= maxChars) lines[lines.length - 1] = last + " " + w
                else lines.push(w)
              }
              const shown = lines.slice(0, leaf ? 3 : 3)
              return (
                <g key={`l-${n.data.key}`} pointerEvents="none" opacity={isDim(n) ? 0.25 : 1}>
                  {shown.map((line, i) => (
                    <text
                      key={i}
                      x={tx(n.x)}
                      y={ty(n.y) + (i - (shown.length - 1) / 2) * fs * 1.15 - (showCluster ? fs * 0.35 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      fontWeight={leaf ? 600 : 700}
                      fill={leaf ? "#fff" : n.depth === 1 ? n.data.color : "#2b2b2e"}
                      style={leaf ? undefined : { paintOrder: "stroke", stroke: "#fffaf3", strokeWidth: 3.5, strokeLinejoin: "round" }}
                    >
                      {line}
                    </text>
                  ))}
                  {showCluster && (
                    <text
                      x={tx(n.x)}
                      y={ty(n.y) + ((shown.length - 1) / 2) * fs * 1.15 + fs * 0.85}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs * 0.62}
                      fill="#5f5f63"
                      style={{ paintOrder: "stroke", stroke: "#fffaf3", strokeWidth: 4 }}
                    >
                      {n.leaves().length} program{n.leaves().length === 1 ? "" : "s"}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg border border-border bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
              style={{
                left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 270),
                top: hover.y + 14,
              }}
            >
              <div className="font-semibold text-foreground">{hover.node.data.name}</div>
              {hover.node.data.program ? (
                <>
                  <div className="mt-0.5 text-muted-foreground">{whenLabel(hover.node.data.program)}</div>
                  {hover.node.data.program.description && (
                    <div className="mt-1 line-clamp-3 text-foreground/80">{hover.node.data.program.description}</div>
                  )}
                  <div className="mt-1 font-medium text-primary">Click for details</div>
                </>
              ) : (
                <div className="mt-0.5 text-muted-foreground">{hover.node.leaves().length} programs, click to zoom in</div>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tap a cluster to zoom in, tap a program for details, tap the background to zoom out.
        </p>
      </div>

      <aside className="rounded-2xl border border-border bg-card p-4 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In view</div>
        <div className="mt-0.5 font-semibold">{focus.data.name}</div>
        <div className="text-xs text-muted-foreground">{visibleLeaves.length} programs</div>
        {focus === root ? (
          <ul className="mt-3 space-y-1">
            {root.children?.map(g => (
              <li key={g.data.key}>
                <button
                  onClick={() => zoomTo(g)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.data.color }} />
                  <span className="flex-1">{g.data.name}</span>
                  <span className="text-xs text-muted-foreground">{g.leaves().length}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 space-y-0.5">
            {visibleLeaves
              .slice()
              .sort((a, b) => a.data.name.localeCompare(b.data.name))
              .map(l => (
                <li key={l.data.key}>
                  <button
                    onClick={() => onOpen(l.data.program!.id)}
                    className={cn(
                      "w-full rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted",
                      isDim(l) && "opacity-40",
                    )}
                  >
                    <div className="font-medium leading-snug">{l.data.name}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{whenLabel(l.data.program!)}</div>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
